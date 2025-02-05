import { IGNORE_MUTATE } from '../../utils/Recaller.js'
import { codec, OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
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
   */
  constructor (name, peer, duplex = null) {
    super(name, peer)
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

  /**
   * @param {TurtleBranch} branch
   * @param {BranchUpdate} [incomingBranchUpdate]
   * @param {BranchUpdate} [lastOutgoingBranchUpdate]
   */
  processBranch (branch, incomingBranchUpdate, lastOutgoingBranchUpdate) {
    const outgoingBranchUpdate = lastOutgoingBranchUpdate ?? {}
    outgoingBranchUpdate.index = branch?.index ?? -1
    outgoingBranchUpdate.uint8Arrays ??= []
    while (incomingBranchUpdate?.uint8Arrays?.[(branch.index ?? -1) + 1]) {
      const address = incomingBranchUpdate.uint8Arrays[(branch.index ?? -1) + 1]
      const uint8Array = this.incomingUpdateBranch.lookup(address)
      this.peer.recaller.call(() => {
        branch.append(uint8Array)
      }, IGNORE_MUTATE) // don't trigger ourselves
    }
    if (incomingBranchUpdate) {
      for (let index = (incomingBranchUpdate.index ?? -1) + 1; index <= branch.index; ++index) {
        this.peer.recaller.call(() => {
          const uint8Array = branch.u8aTurtle.findParentByIndex(index).uint8Array
          outgoingBranchUpdate.uint8Arrays[index] ??= this.outgoingUpdateDictionary.upsert(uint8Array, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
        }, IGNORE_MUTATE) // don't trigger ourselves
      }
    }
    return outgoingBranchUpdate
  }
}
