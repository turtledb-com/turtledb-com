import { IGNORE_ACCESS } from '../../utils/Recaller.js'
import { codec, OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { TurtleDictionary } from '../TurtleDictionary.js'

/**
 * @typedef BranchUpdate
 * @property {string} hostname
 * @property {string} bale
 * @property {string} cpk
 * @property {Uint8Array} hash
 * @property {number} height
 * @property {Array.<number>} uint8Arrays
 */

export class ConnectionEcho {
  /**
   * @param {string} name
   * @param {import('./Peer.js').Peer} peer
   * @param {import('./Peer.js').Duplex} [duplex]
   */
  constructor (name, peer, duplex = null) {
    this.name = name
    this.peer = peer
    this.outgoingUpdateDictionary = new TurtleDictionary(`${name}.outgoingUpdateDictionary`, peer.recaller)
    this.incomingUpdateBranch = new TurtleBranch(`${name}.incomingUpdateBranch`, peer.recaller)
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

  sync () {
    /** @type {Object.<string, Object.<string, Object.<string, BranchUpdate>>>} */
    const incomingUpdate = this.incomingUpdateBranch.lookup() ?? {}
    console.log(this.name, 'incomingUpdate', JSON.stringify(incomingUpdate))

    for (const hostname in incomingUpdate) {
      for (const bale in incomingUpdate[hostname]) {
        for (const cpk in incomingUpdate[hostname][bale]) {
          const branch = this.peer.getBranch(cpk, bale, hostname)
          const branchUpdate = incomingUpdate[hostname][bale][cpk]
          while (branchUpdate?.uint8Arrays?.[(branch.height ?? -1) + 1]) {
            const address = branchUpdate.uint8Arrays[(branch.height ?? -1) + 1]
            const uint8Array = this.incomingUpdateBranch.lookup(address)
            branch.append(uint8Array)
          }
        }
      }
    }

    /** @type {Array.<BranchUpdate>} */
    const lastOutgoingUpdate = this.outgoingUpdateDictionary.lookup()
    /** @type {Array.<BranchUpdate>} */
    const outgoingUpdate = {}
    for (const hostname in this.peer.branches) {
      for (const bale in this.peer.branches[hostname]) {
        for (const cpk in this.peer.branches[hostname][bale]) {
          const incomingBranchUpdate = incomingUpdate?.[hostname]?.[bale]?.[cpk]
          const branch = this.peer.branches[hostname][bale][cpk]
          /** @type {BranchUpdate} */
          const outgoingBranchUpdate = lastOutgoingUpdate?.[hostname]?.[bale]?.[cpk] ?? {}
          outgoingBranchUpdate.height = branch.height ?? -1
          outgoingBranchUpdate.uint8Arrays ??= []
          if (incomingBranchUpdate) {
            for (let height = (incomingBranchUpdate.height ?? -1) + 1; height <= branch.height; ++height) {
              this.peer.recaller.call(() => {
                const uint8Array = branch.u8aTurtle.findParentByHeight(height).uint8Array
                outgoingBranchUpdate.uint8Arrays[height] ??= this.outgoingUpdateDictionary.upsert(uint8Array, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
              }, IGNORE_ACCESS) // don't trigger ourselves
            }
          }
          outgoingUpdate[hostname] ??= {}
          outgoingUpdate[hostname][bale] ??= {}
          outgoingUpdate[hostname][bale][cpk] = outgoingBranchUpdate
        }
      }
    }
    this.peer.recaller.call(() => {
      this.outgoingUpdateDictionary.upsert(outgoingUpdate)
    }, IGNORE_ACCESS) // don't trigger ourselves
  }
}
