import { TurtleBranch } from './TurtleBranch.js'
import { TurtleDictionary } from './TurtleDictionary.js'

/**
 * @typedef Connection
 * @property {ReadableStream} readableStream
 * @property {WritableStream} writableStream
 */

export class Peer extends TurtleDictionary {
  /** @type {Array.<Connection>} */
  connections = []

  constructor (name) {
    super(name)
    this.remote = new TurtleBranch(`${name}.remote`, this.recaller)
  }

  /**
   * @param {Connection} connection
   */
  connect (connection) {
    connection.readableStream.pipeTo(this.remote.makeWritableStream())
    this.makeReadableStream().pipeTo(connection.writableStream)
  }
}
