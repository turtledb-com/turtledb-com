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

export class EchoConnection extends AbstractConnection {
  /**
   * @param {string} name
   * @param {Peer} peer
   * @param {Duplex} duplex
   * @param {boolean} [trusted=false]
   */
  constructor (name, peer, duplex = null, trusted = false) {
    super(name, peer, trusted)
    this.incomingUpdateBranch = new TurtleBranch(`${name}.incomingUpdateBranch`, peer.recaller)
    this.outgoingUpdateDictionary = new TurtleDictionary(`${name}.outgoingUpdateDictionary`, peer.recaller)
    if (duplex) {
      this.duplex = duplex
      duplex.readableStream.pipeTo(this.incomingUpdateBranch.makeWritableStream())
      this.outgoingUpdateDictionary.makeReadableStream().pipeTo(duplex.writableStream)
    } else {
      this.duplex = {
        readableStream: this.outgoingUpdateDictionary.makeReadableStream(),
        writableStream: this.incomingUpdateBranch.makeWritableStream()
      }
    }
  }

  /** @type {Update} */
  get incomingUpdate () { return this.incomingUpdateBranch.lookup() }

  /** @type {Update} */
  get outgoingUpdate () { return this.outgoingUpdateDictionary.lookup() }

  sync () {
    const outgoingUpdate = this.processBranches()
    this.peer.recaller.call(() => {
      this.outgoingUpdateDictionary.upsert(outgoingUpdate)
    }, IGNORE_MUTATE) // don't trigger ourselves
  }

  /**
   * @param {TurtleBranch} branch
   * @param {BranchUpdate} [incomingBranchUpdate]
   * @param {BranchUpdate} [lastOutgoingBranchUpdate]
   */
  processBranch (branch, incomingBranchUpdate, lastOutgoingBranchUpdate) {
    /** @type {(branchlike: { index: number }) => number} */
    const indexOf = branch => branch?.index ?? -1
    console.log(this.name, 'incoming', incomingBranchUpdate)
    /** @type {BranchUpdate} */
    const outgoingBranchUpdate = lastOutgoingBranchUpdate ?? {}
    outgoingBranchUpdate.index = indexOf(branch)
    const turtleParts = outgoingBranchUpdate.turtleParts ??= []
    // console.log('?', indexOf(incomingBranchUpdate), indexOf(branch))
    if (indexOf(branch) >= 0 && indexOf(incomingBranchUpdate) >= indexOf(branch)) {
      const encodedCommit = splitEncodedCommit(branch.u8aTurtle)[1]
      const turtlePart = incomingBranchUpdate.turtleParts[indexOf(branch)]
      if (turtlePart) {
        const incomingCommit = this.incomingUpdateBranch.lookup(turtlePart.commitAddress)
        // console.log(encodedCommit, incomingCommit)
        console.log(compareUint8Arrays(encodedCommit, incomingCommit))
      } else {
        console.log('missing turtlePart', indexOf(branch))
      }
    }
    while (incomingBranchUpdate?.turtleParts?.[indexOf(branch) + 1]) {
      const turtlePart = incomingBranchUpdate.turtleParts[indexOf(branch) + 1]
      const encodedCommit = this.incomingUpdateBranch.lookup(turtlePart.commitAddress)
      const encodedData = this.incomingUpdateBranch.lookup(turtlePart.dataAddress)
      const uint8Array = combineUint8Arrays([encodedData, encodedCommit])
      branch.append(uint8Array)
    }
    if (incomingBranchUpdate) { // only send it if they're ready for it
      if (indexOf(incomingBranchUpdate) >= 0 && indexOf(branch) >= indexOf(incomingBranchUpdate)) {
        const index = incomingBranchUpdate.index
        const uint8Array = branch.u8aTurtle.findParentByIndex(index).uint8Array
        const u8aTurtle = new U8aTurtle(uint8Array)
        const encodedCommit = codec.extractEncodedValue(u8aTurtle)
        const turtlePart = turtleParts[index] ??= {}
        turtlePart.commitAddress ??= this.outgoingUpdateDictionary.upsert(encodedCommit, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
      }
      for (let index = (indexOf(incomingBranchUpdate)) + 1; index <= branch.index; ++index) {
        this.peer.recaller.call(() => {
          const uint8Array = branch.u8aTurtle.findParentByIndex(index).uint8Array
          const u8aTurtle = new U8aTurtle(uint8Array)
          const encodedCommit = codec.extractEncodedValue(u8aTurtle)
          const turtlePart = turtleParts[index] ??= {}
          turtlePart.commitAddress ??= this.outgoingUpdateDictionary.upsert(encodedCommit, [codec.getCodecType(OPAQUE_UINT8ARRAY)])

          const encodedData = uint8Array.slice(0, -encodedCommit.length)
          turtlePart.dataAddress ??= this.outgoingUpdateDictionary.upsert(encodedData, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
        }, IGNORE_MUTATE) // don't trigger ourselves
      }
    }
    return outgoingBranchUpdate
  }
}
