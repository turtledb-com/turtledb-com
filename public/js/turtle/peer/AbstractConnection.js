/**
 * @typedef {import('./Peer.js').Peer} Peer
 * @typedef {import('../TurtleBranch.js').TurtleBranch} TurtleBranch
 */

/**
 * @typedef TurtlePart
 * @property {number} commitAddress
 * @property {number} dataAddress
 *
 * @typedef BranchUpdate
 * @property {number} index
 * @property {Array.<TurtlePart>} turtleParts
 *
 * @typedef BaleUpdate
 * @property {string} defaultCpk
 * @property {Array.<string>} availableBranches
 * @property {Object.<string, BranchUpdate>} branchUpdates
 *
 * @typedef HostUpdate
 * @property {string} defaultBale
 * @property {Object.<string, BaleUpdate>} baleUpdates
 *
 * @typedef Update
 * @property {string} defaultHost
 * @property {Object.<string, HostUpdate>} hostUpdates
 */

export class AbstractConnection {
  /**
   * @param {String} name
   * @param {Peer} peer
   * @param {boolean} [trusted=false]
   */
  constructor (name, peer, trusted = false) {
    this.name = name
    this.peer = peer
  }

  /** @type {Update} */
  get incomingUpdate () { throw new Error('incomingUpdate getter must be overridden') }

  /** @type {Update} */
  get outgoingUpdate () { throw new Error('outgoingUpdate getter must be overridden') }

  sync () {
    throw new Error('sync method must be overridden')
  }

  /**
   * @param {TurtleBranch} branch
   * @param {BranchUpdate} [incomingBranchUpdate]
   * @param {BranchUpdate} [lastOutgoingBranchUpdate]
   * @param {string} cpk
   * @param {string} balename
   * @param {string} hostname
   */
  processBranch (branch, incomingBranchUpdate, lastOutgoingBranchUpdate, cpk, balename, hostname) {
    throw new Error('processBranch method must be overridden')
  }

  processBranches () {
    const outgoingUpdate = { hostUpdates: {} }
    const incomingUpdate = this.incomingUpdate
    const incomingHostUpdates = incomingUpdate?.hostUpdates ?? {}
    const lastOutgoingUpdates = this.outgoingUpdate
    /** @type {Update} */
    const hostnames = new Set([...Object.keys(incomingHostUpdates), ...Object.keys(this.peer.branchesByHostBaleCpk)])
    for (const hostname of hostnames) {
      const incomingHostUpdate = incomingHostUpdates[hostname]
      const incomingBaleUpdates = incomingHostUpdate?.baleUpdates ?? {}
      const branchesByBaleCpk = this.peer.branchesByHostBaleCpk[hostname] ?? {}
      const balenames = new Set([...Object.keys(incomingBaleUpdates), ...Object.keys(branchesByBaleCpk)])
      for (const balename of balenames) {
        const incomingBaleUpdate = incomingBaleUpdates[balename]
        const incomingBranchUpdates = incomingBaleUpdate?.branchUpdates ?? {}
        const branchesByCpk = branchesByBaleCpk[balename] ?? {}
        const cpks = new Set([...Object.keys(incomingBranchUpdates), ...Object.keys(branchesByCpk)])
        for (const cpk of cpks) {
          const lastOutgoingBranchUpdate = lastOutgoingUpdates?.hostUpdates?.[hostname]?.baleUpdates?.[balename]?.branchUpdates?.[cpk] ?? {}
          const incomingBranchUpdate = incomingBranchUpdates[cpk]
          const branch = this.peer.getBranch(cpk, balename, hostname)
          const outgoingBranchUpdate = this.processBranch(branch, incomingBranchUpdate, lastOutgoingBranchUpdate, cpk, balename, hostname)
          outgoingUpdate.hostUpdates[hostname] ??= { baleUpdates: {} }
          outgoingUpdate.hostUpdates[hostname].baleUpdates[balename] ??= { branchUpdates: {} }
          outgoingUpdate.hostUpdates[hostname].baleUpdates[balename].branchUpdates[cpk] = outgoingBranchUpdate
        }
      }
    }
    return outgoingUpdate
  }
}
