import { Recaller } from '../../utils/Recaller.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { proxyWithRecaller } from '../utils.js'
import { Workspace } from '../Workspace.js'

/**
 * @typedef Duplex
 * @property {ReadableStream} readableStream
 * @property {WritableStream} writableStream
 */

export class Peer {
  /** @type {Array.<import('./AbstractConnection.js').AbstractConnection>} */
  connections

  /** @type {Object.<string, TurtleBranch>} */
  branches

  /**
   * @param {string} name
   * @param {Recaller} recaller
   */
  constructor (name, recaller = new Recaller(name)) {
    this.name = name
    this.recaller = recaller
    this.connections = proxyWithRecaller([], recaller)
    this.branches = proxyWithRecaller({}, recaller)
    this.recaller.watch('handle remote updates', () => {
      this.connections.forEach(connection => connection.sync())
    })
  }

  /**
   * @param {string} cpk
   * @param {string} [bale=cpk]
   * @param {string} [hostname='turtledb.com']
   * @returns {TurtleBranch}
   */
  getBranch (cpk, bale = cpk, hostname = 'turtledb.com') {
    this.branches[hostname] ??= proxyWithRecaller({}, this.recaller)
    this.branches[hostname][bale] ??= proxyWithRecaller({}, this.recaller)
    this.branches[hostname][bale][cpk] ??= new TurtleBranch(cpk, this.recaller)
    return this.branches[hostname][bale][cpk]
  }

  /**
   * @param {import('../Signer.js').Signer} signer
   * @param {string} name
   * @param {string} bale
   * @param {string} hostname
   * @returns {Workspace}
   */
  async getWorkspace (signer, name, bale, hostname) {
    const keys = await signer.makeKeysFor(name)
    return new Workspace(signer, name, this.getBranch(keys.publicKey, bale, hostname))
  }
}
