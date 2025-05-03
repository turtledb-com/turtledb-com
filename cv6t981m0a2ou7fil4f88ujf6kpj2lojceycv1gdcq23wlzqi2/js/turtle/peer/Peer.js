import { proxyWithRecaller } from '../../utils/proxyWithRecaller.js'
import { Recaller } from '../../utils/Recaller.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { Workspace } from '../Workspace.js'

/**
 * @typedef {import('./AbstractConnection.js').AbstractConnection} AbstractConnection
 * @typedef {import('../Signer.js').Signer} Signer
 */

export class Peer {
  /** @type {Array.<AbstractConnection>} */
  connections

  /** @type {Object.<string, Object.<string, Object.<string, TurtleBranch>>>} */
  branchesByHostBaleCpk

  /**
   * @param {string} name
   * @param {Recaller} recaller
   */
  constructor (name, recaller = new Recaller(name), defaultCpk, defaultBale = defaultCpk, defaultHost = 'turtledb.com') {
    this.name = name
    this.recaller = recaller
    this.defaultCpk = defaultCpk
    this.defaultBale = defaultBale
    this.defaultHost = defaultHost
    this.branchesByHostBaleCpk = proxyWithRecaller({}, recaller)
  }

  /**
   * @param {string} cpk
   * @param {string} [bale=cpk]
   * @param {string} [hostname='turtledb.com']
   * @returns {TurtleBranch}
   */
  getBranch (cpk, bale = cpk, hostname = this.defaultHost) {
    if (!cpk) cpk = this.defaultCpk
    if (!bale) bale = this.defaultBale
    this.branchesByHostBaleCpk[hostname] ??= proxyWithRecaller({}, this.recaller)
    this.branchesByHostBaleCpk[hostname][bale] ??= proxyWithRecaller({}, this.recaller)
    this.branchesByHostBaleCpk[hostname][bale][cpk] ??= new TurtleBranch(cpk, this.recaller)
    return this.branchesByHostBaleCpk[hostname][bale][cpk]
  }

  /**
   * @param {string} name
   * @param {Signer} signer
   * @param {string} bale
   * @param {string} hostname
   * @returns {Workspace}
   */
  async getWorkspace (name, signer, bale, hostname) {
    const keys = await signer.makeKeysFor(name)
    return new Workspace(name, signer, this.getBranch(keys.publicKey, bale, hostname))
  }
}
