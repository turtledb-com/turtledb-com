/**
 * @typedef {import('../../utils/Recaller.js').Recaller} Recaller
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
  constructor (name, peer, trusted = false, broadcast = false) {
    this.name = name
    this.peer = peer
    this.trusted = trusted // resolve conflicts in our favor if trusted
    this.broadcast = broadcast // offer to share everything in our peer
  }

  /** @type {Update} */
  get incomingUpdate () { throw new Error('incomingUpdate getter must be overridden') }

  /** @type {Update} */
  get outgoingUpdate () { throw new Error('outgoingUpdate getter must be overridden') }

  /**
   * @param {string} cpk
   * @param {string} balename
   * @param {string} hostname
   */
  async processBranch (cpk, balename, hostname) {
    throw new Error('processBranch method must be overridden')
  }

  /**
   * @param {AbstractPeerState} ours
   * @param {AbstractPeerState} theirs
   */
  forEachHostBaleCpk (ours, theirs) {
  }

  startSyncing () {
    if (this.sync) return
    this.sync = () => {
      const incomingUpdate = this.incomingUpdate
      const incomingHostUpdates = incomingUpdate?.hostUpdates ?? {}
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
            this.processBranch(cpk, balename, hostname)
          }
        }
      }
    }
    this.peer.recaller.watch(this.name, this.sync)
  }
}

export class AbstractPeerState {
  /**
   * @param {AbstractConnection} connection
   */
  constructor (connection) {
    this.connection = connection
  }

  /**
   * @param {(cpk, balename, hostname) => void} f
   */
  forEach (f) {
  }
}

export class AbstractTurtleState {
  /**
   * @param {AbstractPeerState} peerState
   * @param {string} cpk
   * @param {string} balename
   * @param {string} hostname
   */
  constructor (peerState, cpk, balename, hostname) {
    this.peerState = peerState
    this.cpk = cpk
    this.balename = balename
    this.hostname = hostname
  }
}
