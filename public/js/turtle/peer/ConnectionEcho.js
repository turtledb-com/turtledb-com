import { IGNORE_MUTATE } from '../../utils/Recaller.js'
import { codec, OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { TurtleDictionary } from '../TurtleDictionary.js'

/**
 * @typedef {import('./Peer.js').BranchUpdate} BranchUpdate
 * @typedef {import('./Peer.js').Connection} Connection
 * @typedef {import('./Peer.js').Peer} Peer
 * @typedef {import('./Peer.js').Duplex} Duplex
 */

/**
 * @implements {Connection}
 */
export class ConnectionEcho {
  /**
   * @param {string} name
   * @param {Peer} peer
   * @param {Duplex} duplex
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
    // this.peer.recaller.debug = true
    /** @type {Object.<string, Object.<string, Object.<string, BranchUpdate>>>} */
    const incomingUpdates = this.incomingUpdateBranch.lookup() ?? {}

    // apply incoming updates
    for (const hostname in incomingUpdates) {
      for (const bale in incomingUpdates[hostname]) {
        for (const cpk in incomingUpdates[hostname][bale]) {
          const branch = this.peer.getBranch(cpk, bale, hostname)
          const branchUpdate = incomingUpdates[hostname][bale][cpk]
          while (branchUpdate?.uint8Arrays?.[(branch.height ?? -1) + 1]) {
            const address = branchUpdate.uint8Arrays[(branch.height ?? -1) + 1]
            const uint8Array = this.incomingUpdateBranch.lookup(address)
            this.peer.recaller.call(() => {
              branch.append(uint8Array)
            }, IGNORE_MUTATE) // don't trigger ourselves
          }
        }
      }
    }

    /** @type {Object.<string, Object.<string, Object.<string, BranchUpdate>>>} */
    const lastOutgoingUpdates = this.outgoingUpdateDictionary.lookup()
    /** @type {Object.<string, Object.<string, Object.<string, BranchUpdate>>>} */
    const outgoingUpdate = {}
    for (const hostname in this.peer.branches) {
      for (const bale in this.peer.branches[hostname]) {
        for (const cpk in this.peer.branches[hostname][bale]) {
          const incomingBranchUpdate = incomingUpdates?.[hostname]?.[bale]?.[cpk]
          const branch = this.peer.branches[hostname][bale][cpk]
          const outgoingBranchUpdate = lastOutgoingUpdates?.[hostname]?.[bale]?.[cpk] ?? {}
          outgoingBranchUpdate.height = branch.height ?? -1
          outgoingBranchUpdate.uint8Arrays ??= []
          if (incomingBranchUpdate) {
            for (let height = (incomingBranchUpdate.height ?? -1) + 1; height <= branch.height; ++height) {
              this.peer.recaller.call(() => {
                const uint8Array = branch.u8aTurtle.findParentByHeight(height).uint8Array
                outgoingBranchUpdate.uint8Arrays[height] ??= this.outgoingUpdateDictionary.upsert(uint8Array, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
              }, IGNORE_MUTATE) // don't trigger ourselves
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
    }, IGNORE_MUTATE) // don't trigger ourselves
  }
}
