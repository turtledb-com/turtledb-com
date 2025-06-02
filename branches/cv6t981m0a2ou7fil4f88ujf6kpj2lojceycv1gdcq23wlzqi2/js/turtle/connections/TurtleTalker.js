import { Recaller } from '../../utils/Recaller.js'
import { TurtleBranch } from '../TurtleBranch.js'

/**
 * @typedef {{ts: Date, uint8ArrayAddresses: Array.<number>}} TurtleTalk
 */

export class TurtleTalker {
  /**
   * @param {string} name
   * @param {boolean} [Xours=false]
   * @param {Recaller} [recaller=new Recaller(`${name}.recaller`)]
   */
  constructor (
    name,
    Xours = false,
    recaller = new Recaller(`${name}.recaller`)
  ) {
    this.name = name
    this.Xours = Xours
    this.recaller = recaller
    this.outgoingBranch = new TurtleBranch(`${name}.outgoingBranch`, recaller)
    this.incomingBranch = new TurtleBranch(`${name}.incomingBranch`, recaller)
  }

  /** @param {TurtleTalk|TurtleBranch} connection */
  connect (connection) {
    this.makeReadableStream().pipeTo(connection.makeWritableStream())
    connection.makeReadableStream().pipeTo(this.makeWritableStream())
  }

  makeReadableStream () { return this.outgoingBranch.makeReadableStream() }
  makeWritableStream () { return this.incomingBranch.makeWritableStream() }
}
