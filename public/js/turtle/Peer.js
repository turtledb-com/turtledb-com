import { TurtleBranch } from './TurtleBranch.js'
import { TurtleDictionary } from './TurtleDictionary.js'

/**
 * @typedef Duplex
 * @property {ReadableStream} readableStream
 * @property {WritableStream} writableStream
 */

/**
 * @typedef connection
 * @property {Duplex} duplex
 * @property {TurtleDictionary} localDictionary
 * @property {TurtleBranch} remoteBranch
 */

export class Peer extends TurtleDictionary {
  /** @type {Array.<{localDictionary: TurtleBranch, remoteBranch: TurtleBranch, connection: Duplex>} */
  connections = []

  constructor (name) {
    super(name)
    this.recaller.watch('handle remote updates', () => {
      this.recaller.reportKeyAccess(this, 'connection', 'update', this.name)
      this.connections.forEach(connection => {
        const localState = connection.localDictionary.lookup()
        const remoteState = connection.remoteBranch.lookup()
        console.log({ localState, remoteState })
      })
    })
  }

  /**
   * @returns {Duplex}
   */
  makeConnection () {
    const index = this.connections.length
    const localDictionary = new TurtleDictionary(`${this.name}.connections.${index}.localDictionary`, this.recaller)
    const remoteBranch = new TurtleBranch(`${this.name}.connections.${index}.remoteBranch`, this.recaller)
    const connection = { readableStream: localDictionary.makeReadableStream(), writableStream: remoteBranch.makeWritableStream() }
    this.connections.push({ localDictionary, remoteBranch, connection })
    this.recaller.reportKeyMutation(this, 'connection', 'makeConnection', this.name)
    return connection
  }

  /**
   * @param {Duplex} connection
   */
  connect (connection) {
    const index = this.connections.length
    const localDictionary = new TurtleDictionary(`${this.name}.connections.${index}.localDictionary`, this.recaller)
    const remoteBranch = new TurtleBranch(`${this.name}.connections.${index}.remoteBranch`, this.recaller)
    this.connections.push({ localDictionary, remoteBranch, connection })
    this.recaller.reportKeyMutation(this, 'connection', 'connect', this.name)
    connection.readableStream.pipeTo(remoteBranch.makeWritableStream())
    localDictionary.makeReadableStream().pipeTo(connection.writableStream)
  }
}
