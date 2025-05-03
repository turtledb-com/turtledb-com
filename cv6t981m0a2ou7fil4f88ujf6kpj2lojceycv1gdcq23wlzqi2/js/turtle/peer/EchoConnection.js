import { combineUint8Arrays } from '../../utils/combineUint8Arrays.js'
import { codec, OPAQUE_UINT8ARRAY, splitEncodedCommit } from '../codecs/codec.js'
import { verifyTurtleCommit } from '../Signer.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { U8aTurtle } from '../U8aTurtle.js'
import { deepEqualUint8Arrays } from '../utils.js'
import { AbstractConnection, AbstractPeerState } from './AbstractConnection.js'

/**
 * @typedef {import('../../utils/Recaller.js').Recaller} Recaller
 * @typedef {import('./AbstractConnection.js').Update} Update
 * @typedef {import('./AbstractConnection.js').BranchUpdate} BranchUpdate
 * @typedef {import('./Peer.js').Peer} Peer
 * @typedef {import('./Peer.js').Duplex} Duplex
 */

/** @type {(branchlike: { index: number }) => number} */
const indexOf = branch => branch?.index ?? -1

export class EchoConnection extends AbstractConnection {
  /**
   * @param {string} name
   * @param {Peer} peer
   * @param {boolean} trusted
   * @param {Duplex} [duplex=null]
   */
  constructor (name, peer, trusted, duplex = null) {
    super(name, peer, trusted)
    this.incomingBranch = new TurtleBranch(`${name}.incomingBranch`, peer.recaller)
    this.outgoingBranch = new TurtleBranch(`${name}.outgoingBranch`, peer.recaller)
    this.outgoingDictionary = new TurtleDictionary(`${name}.outgoingDictionary`)
    if (duplex) {
      this.duplex = duplex
      duplex.readableStream.pipeTo(this.incomingBranch.makeWritableStream())
      this.outgoingBranch.makeReadableStream().pipeTo(duplex.writableStream)
    } else {
      this.duplex = {
        readableStream: this.outgoingBranch.makeReadableStream(),
        writableStream: this.incomingBranch.makeWritableStream()
      }
    }
    this.startSyncing()
  }

  /** @type {Update} */
  get incomingUpdate () { return this.incomingBranch.lookup() }

  /** @type {Update} */
  get outgoingUpdate () { return this.outgoingBranch.lookup() }

  /**
   * @param {Recaller} recaller
   */
  async #old_sync (recaller) {
    await new Promise(resolve => setTimeout(resolve)) // get out from recaller.watch

    if (this.selfSync) return
    this.selfSync = async () => {
      const outgoingUpdate = this.processBranches()
      // console.log('  ↓↓  ', this.name, 'incoming', this.incomingBranch.lookup(), this.incomingBranch.length)
      this.outgoingDictionary.upsert(outgoingUpdate)
      if (indexOf(this.outgoingDictionary) > indexOf(this.outgoingBranch)) {
        this.outgoingDictionary.squash(indexOf(this.outgoingBranch) + 1)
        this.outgoingBranch.append(this.outgoingDictionary.u8aTurtle.uint8Array)
        // console.log('  ⬆️  ', this.name, 'outgoing', this.outgoingBranch.lookup(), this.outgoingBranch.length)
      }
    }
    recaller.watch(`EchoConnection.name: ${this.name} start self-syncing`, this.selfSync)
  }

  /**
   * @param {string} cpk
   * @param {string} balename
   * @param {string} hostname
   */
  async processBranch (cpk, balename, hostname) {
    await new Promise(resolve => setTimeout(resolve)) // get out from recaller.watch

    const logUpdates = (branch, prefix = '  ..  ') => {
      /** @type {Update} */
      const update = branch.lookup()
      console.log(prefix, this.name, cpk.substring(0, 8), 'branch.length:', branch.length)
      if (!update) return console.log(prefix, update)
      for (const hostname in update.hostUpdates) {
        const hostUpdate = update.hostUpdates[hostname]
        for (const balename in hostUpdate.baleUpdates) {
          const baleUpdate = hostUpdate.baleUpdates[balename]
          for (const cpk in baleUpdate.branchUpdates) {
            const branchUpdate = baleUpdate.branchUpdates[cpk]
            if (branchUpdate.index === undefined) {
              console.log(prefix, '   (empty)')
            } else {
              console.log(prefix, '   index:', branchUpdate.index)
              console.log(prefix, '   turtleParts: [')
              branchUpdate.turtleParts?.forEach?.(turtlePart => {
                console.log(prefix, '    ', turtlePart)
              })
              console.log(prefix, '   ]')
            }
          }
        }
      }
    }

    if (this.selfUpdater) return
    this.selfUpdater = async () => {
      // logUpdates(this.incomingBranch, `  ↓↓  ${this.name}, incoming`)
      const lastOutgoingBranchUpdate = this.outgoingUpdate?.hostUpdates?.[hostname]?.baleUpdates?.[balename]?.branchUpdates?.[cpk] ?? {}
      const incomingUpdate = this.incomingUpdate
      const incomingBranchUpdate = incomingUpdate?.hostUpdates?.[hostname]?.baleUpdates?.[balename]?.branchUpdates?.[cpk]
      const branch = this.peer.getBranch(cpk, balename, hostname)

      // console.log('  ↓  ', this.name, 'incoming', incomingBranchUpdate, branch.length)
      /** @type {BranchUpdate} */
      const outgoingBranchUpdate = lastOutgoingBranchUpdate ?? {}

      this.handleConflicts(branch, incomingBranchUpdate, outgoingBranchUpdate)
      if (incomingBranchUpdate && indexOf(branch) >= indexOf(incomingBranchUpdate)) { // only send it if they're ready for it
        outgoingBranchUpdate.index = indexOf(branch)
        const turtleParts = outgoingBranchUpdate.turtleParts ??= []
        // so they can check their turtle against ours
        if (indexOf(incomingBranchUpdate) >= 0) {
          const index = incomingBranchUpdate.index
          const uint8Array = branch.u8aTurtle.getAncestorByIndex(index).uint8Array
          const u8aTurtle = new U8aTurtle(uint8Array)
          const encodedCommit = codec.extractEncodedValue(u8aTurtle)
          const turtlePart = turtleParts[index] ??= {}
          turtlePart.commitAddress ??= this.outgoingDictionary.upsert(encodedCommit, [OPAQUE_UINT8ARRAY])
        }
        // send them what they're missing
        for (let index = (indexOf(incomingBranchUpdate)) + 1; index <= indexOf(branch); ++index) {
          const uint8Array = branch.u8aTurtle.getAncestorByIndex(index).uint8Array
          const u8aTurtle = new U8aTurtle(uint8Array)
          const encodedCommit = codec.extractEncodedValue(u8aTurtle)
          const turtlePart = turtleParts[index] ??= {}
          turtlePart.commitAddress ??= this.outgoingDictionary.upsert(encodedCommit, [OPAQUE_UINT8ARRAY])
          const encodedData = uint8Array.slice(0, -encodedCommit.length)
          turtlePart.dataAddress ??= this.outgoingDictionary.upsert(encodedData, [OPAQUE_UINT8ARRAY])
          turtleParts[index] = turtlePart
        }
      }
      const updateOutgoingBranch = () => {
        const outgoingUpdate = this.outgoingUpdate ?? { hostUpdates: {} }
        outgoingUpdate.hostUpdates[hostname] ??= { baleUpdates: {} }
        outgoingUpdate.hostUpdates[hostname].baleUpdates[balename] ??= { branchUpdates: {} }
        outgoingUpdate.hostUpdates[hostname].baleUpdates[balename].branchUpdates[cpk] = outgoingBranchUpdate
        this.outgoingDictionary.upsert(outgoingUpdate)
        if (indexOf(this.outgoingDictionary) > indexOf(this.outgoingBranch)) {
          this.outgoingDictionary.squash(indexOf(this.outgoingBranch) + 1)
          this.outgoingBranch.append(this.outgoingDictionary.u8aTurtle.uint8Array)
          this.outgoingDictionary.u8aTurtle = this.outgoingBranch.u8aTurtle
          // logUpdates(this.outgoingBranch, `  ⬆  ${this.name}, outgoing`)
        }
      }
      // copy any new data
      while (incomingBranchUpdate?.turtleParts?.[indexOf(branch) + 1]) {
        const turtlePart = incomingBranchUpdate.turtleParts[indexOf(branch) + 1]
        const encodedCommit = this.incomingBranch.lookup(turtlePart.commitAddress)
        const encodedData = this.incomingBranch.lookup(turtlePart.dataAddress)
        const uint8Array = combineUint8Arrays([encodedData, encodedCommit])
        // console.log(new U8aTurtle(uint8Array, branch.u8aTurtle))
        const verified = verifyTurtleCommit(new U8aTurtle(uint8Array, branch.u8aTurtle), cpk)
        // await new Promise(resolve => setTimeout(resolve))
        // console.log({ verified })
        branch.append(uint8Array)
        const verified2 = verifyTurtleCommit(branch.u8aTurtle, cpk)
        // console.log({ verified2 })
        outgoingBranchUpdate.index = indexOf(branch)
        updateOutgoingBranch()
      }
      updateOutgoingBranch()
    }
    this.peer.recaller.watch('self updating branch', this.selfUpdater)
  }

  /**
   * @param {TurtleBranch} branch
   * @param {BranchUpdate} [incomingBranchUpdate]
   * @param {BranchUpdate} [outgoingBranchUpdate]
   */
  handleConflicts (branch, incomingBranchUpdate, outgoingBranchUpdate) {
    if (indexOf(branch) === -1) return
    if (indexOf(incomingBranchUpdate) === -1) return
    if (!incomingBranchUpdate.turtleParts) return
    for (const index in incomingBranchUpdate.turtleParts) {
      const i = +index
      const u8aTurtle = branch.u8aTurtle.getAncestorByIndex(i)
      if (!u8aTurtle) break
      const turtlePart = incomingBranchUpdate.turtleParts[i]
      /** @type {Uint8Array} */
      const incomingEncodedCommit = this.incomingBranch.lookup(turtlePart.commitAddress)
      const actualEncodedCommit = splitEncodedCommit(u8aTurtle)[1]
      if (!deepEqualUint8Arrays(incomingEncodedCommit, actualEncodedCommit)) {
        console.error('incoming conflict', {
          index,
          'branch.name': branch.name,
          'connection.name': this.name,
          trusted: this.trusted
        })
        if (this.trusted) {
          incomingBranchUpdate.index = i - 1
          incomingBranchUpdate.turtleParts.splice(i)
        } else {
          branch.u8aTurtle = u8aTurtle.parent
          outgoingBranchUpdate.index = i - 1
          outgoingBranchUpdate.turtleParts.splice(i)
        }
      }
    }
  }
}

export class EchoPeerState extends AbstractPeerState {
  /** @type {EchoConnection} */
  connection
}
