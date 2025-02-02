import { IGNORE_MUTATE } from '../../utils/Recaller.js'
import { codec, OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
import { AbstractConnection } from './AbstractConnection.js'

/**
 * @typedef {import('./AbstractConnection.js').Update} Update
 * @typedef {import('./Peer.js').BranchUpdate} BranchUpdate
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
    const incomingUpdate = this.incomingUpdate

    // apply incoming updates
    const hostUpdates = incomingUpdate?.hostUpdates ?? {}
    for (const hostname in hostUpdates) {
      const hostUpdate = hostUpdates[hostname]
      const baleUpdates = hostUpdate?.baleUpdates ?? {}
      for (const balename in baleUpdates) {
        const baleUpdate = baleUpdates[balename]
        const branchUpdates = baleUpdate?.branchUpdates ?? {}
        for (const cpk in branchUpdates) {
          const branchUpdate = branchUpdates[cpk]
          const branch = this.peer.getBranch(cpk, balename, hostname)
          while (branchUpdate?.uint8Arrays?.[(branch.index ?? -1) + 1]) {
            const address = branchUpdate.uint8Arrays[(branch.index ?? -1) + 1]
            const uint8Array = this.incomingUpdateBranch.lookup(address)
            this.peer.recaller.call(() => {
              branch.append(uint8Array)
            }, IGNORE_MUTATE) // don't trigger ourselves
          }
        }
      }
    }

    const lastOutgoingUpdates = this.outgoingUpdate
    /** @type {Update} */
    const outgoingUpdate = { hostUpdates: {} }
    for (const hostname in this.peer.branches) {
      for (const bale in this.peer.branches[hostname]) {
        for (const cpk in this.peer.branches[hostname][bale]) {
          const incomingBranchUpdate = incomingUpdate?.hostUpdates?.[hostname]?.baleUpdates?.[bale]?.branchUpdates?.[cpk]
          const branch = this.peer.branches[hostname][bale][cpk]
          const outgoingBranchUpdate = lastOutgoingUpdates?.hostUpdates?.[hostname]?.baleUpdates?.[bale]?.branchUpdates?.[cpk] ?? {}
          outgoingBranchUpdate.index = branch.index ?? -1
          outgoingBranchUpdate.uint8Arrays ??= []
          if (incomingBranchUpdate) {
            for (let index = (incomingBranchUpdate.index ?? -1) + 1; index <= branch.index; ++index) {
              this.peer.recaller.call(() => {
                const uint8Array = branch.u8aTurtle.findParentByIndex(index).uint8Array
                outgoingBranchUpdate.uint8Arrays[index] ??= this.outgoingUpdateDictionary.upsert(uint8Array, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
              }, IGNORE_MUTATE) // don't trigger ourselves
            }
          }
          outgoingUpdate.hostUpdates[hostname] ??= { baleUpdates: {} }
          outgoingUpdate.hostUpdates[hostname].baleUpdates[bale] ??= { branchUpdates: {} }
          outgoingUpdate.hostUpdates[hostname].baleUpdates[bale].branchUpdates[cpk] = outgoingBranchUpdate
        }
      }
    }
    this.peer.recaller.call(() => {
      this.outgoingUpdateDictionary.upsert(outgoingUpdate)
    }, IGNORE_MUTATE) // don't trigger ourselves
  }
}
