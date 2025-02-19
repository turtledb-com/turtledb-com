import { IGNORE_MUTATE } from '../../utils/Recaller.js'
import { codec, OPAQUE_UINT8ARRAY, splitEncodedCommit } from '../codecs/codec.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { U8aTurtle } from '../U8aTurtle.js'
import { combineUint8Arrays, compareUint8Arrays } from '../utils.js'
import { AbstractConnection } from './AbstractConnection.js'

/**
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
    this.outgoingDictionary = new TurtleDictionary(`${name}.outgoingDictionary`, peer.recaller)
    if (duplex) {
      this.duplex = duplex
      duplex.readableStream.pipeTo(this.incomingBranch.makeWritableStream())
      this.outgoingDictionary.makeReadableStream().pipeTo(duplex.writableStream)
    } else {
      this.duplex = {
        readableStream: this.outgoingDictionary.makeReadableStream(),
        writableStream: this.incomingBranch.makeWritableStream()
      }
    }
  }

  /** @type {Update} */
  get incomingUpdate () { return this.incomingBranch.lookup() }

  /** @type {Update} */
  get outgoingUpdate () { return this.outgoingDictionary.lookup() }

  /**
   * @param {import('../../utils/Recaller.js').Recaller} recaller
   */
  sync (recaller) {
    if (this.syncing) return
    this.syncing = true
    recaller.watch(this.name, () => {
      const outgoingUpdate = this.processBranches()
      this.peer.recaller.call(() => {
        this.outgoingDictionary.upsert(outgoingUpdate)
      }, IGNORE_MUTATE) // don't trigger ourselves
    })
  }

  /**
   * @param {TurtleBranch} branch
   * @param {BranchUpdate} [incomingBranchUpdate]
   * @param {BranchUpdate} [lastOutgoingBranchUpdate]
   */
  processBranch (branch, incomingBranchUpdate, lastOutgoingBranchUpdate) {
    console.log('  ↓  ', this.name, 'incoming', incomingBranchUpdate, branch.length)
    /** @type {BranchUpdate} */
    const outgoingBranchUpdate = lastOutgoingBranchUpdate ?? {}

    outgoingBranchUpdate.index = indexOf(branch)
    const turtleParts = outgoingBranchUpdate.turtleParts ??= []
    this.handleConflicts(branch, incomingBranchUpdate, outgoingBranchUpdate)
    // copy any new data
    while (incomingBranchUpdate?.turtleParts?.[indexOf(branch) + 1]) {
      const turtlePart = incomingBranchUpdate.turtleParts[indexOf(branch) + 1]
      const encodedCommit = this.incomingBranch.lookup(turtlePart.commitAddress)
      const encodedData = this.incomingBranch.lookup(turtlePart.dataAddress)
      const uint8Array = combineUint8Arrays([encodedData, encodedCommit])
      branch.append(uint8Array)
    }
    if (incomingBranchUpdate) { // only send it if they're ready for it
      // so they can check their turtle against ours
      if (indexOf(incomingBranchUpdate) >= 0 && indexOf(branch) >= indexOf(incomingBranchUpdate)) {
        const index = incomingBranchUpdate.index
        const uint8Array = branch.u8aTurtle.findParentByIndex(index).uint8Array
        const u8aTurtle = new U8aTurtle(uint8Array)
        const encodedCommit = codec.extractEncodedValue(u8aTurtle)
        const turtlePart = turtleParts[index] ??= {}
        turtlePart.commitAddress ??= this.outgoingDictionary.upsert(encodedCommit, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
      }
      // send them what they're missing
      for (let index = (indexOf(incomingBranchUpdate)) + 1; index <= indexOf(branch); ++index) {
        this.peer.recaller.call(() => {
          const uint8Array = branch.u8aTurtle.findParentByIndex(index).uint8Array
          const u8aTurtle = new U8aTurtle(uint8Array)
          const encodedCommit = codec.extractEncodedValue(u8aTurtle)
          const turtlePart = turtleParts[index] ??= {}
          turtlePart.commitAddress ??= this.outgoingDictionary.upsert(encodedCommit, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
          const encodedData = uint8Array.slice(0, -encodedCommit.length)
          turtlePart.dataAddress ??= this.outgoingDictionary.upsert(encodedData, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
          turtleParts[index] = turtlePart
        }, IGNORE_MUTATE) // don't trigger ourselves
      }
    }
    console.log('  ↑  ', this.name, 'outgoing', outgoingBranchUpdate, branch.length)
    return outgoingBranchUpdate
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
      const u8aTurtle = branch.u8aTurtle.findParentByIndex(i)
      if (!u8aTurtle) break
      const turtlePart = incomingBranchUpdate.turtleParts[i]
      /** @type {Uint8Array} */
      const incomingEncodedCommit = this.incomingBranch.lookup(turtlePart.commitAddress)
      const actualEncodedCommit = splitEncodedCommit(u8aTurtle)[1]
      if (!compareUint8Arrays(incomingEncodedCommit, actualEncodedCommit)) {
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
