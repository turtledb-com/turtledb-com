import { TurtleBranch } from '../TurtleBranch.js'
import { TurtleDictionary } from '../TurtleDictionary.js'

/**
 * @typedef BranchUpdate
 * @property {number} index
 * @property {Array.<number>} commits
 * @property {Array.<number>} uint8Arrays
 */

/**
 * @typedef BaleUpdate
 * @property {string} defaultCpk
 * @property {Array.<string>} availableBranches
 * @property {Object.<string, BranchUpdate>} branchUpdates
 */

/**
 * @typedef HostUpdate
 * @property {string} defaultBale
 * @property {Object.<string, BaleUpdate>} baleUpdates
 */

/**
 * @typedef Update
 * @property {string} defaultHost
 * @property {Object.<string, HostUpdate>} hostUpdates
 */

export class AbstractConnection {
  /**
   * @param {String} name
   * @param {import('./Peer.js').Peer} peer
   */
  constructor (name, peer) {
    this.name = name
    this.peer = peer
    this.incomingUpdateBranch = new TurtleBranch(`${name}.incomingUpdateBranch`, peer.recaller)
    this.outgoingUpdateDictionary = new TurtleDictionary(`${name}.outgoingUpdateDictionary`, peer.recaller)
  }

  /** @type {Update} */
  get incomingUpdate () { return this.incomingUpdateBranch.lookup() }

  /** @type {Update} */
  get outgoingUpdate () { return this.outgoingUpdateDictionary.lookup() }

  sync () { throw new Error('sync method must be overridden') }
}
