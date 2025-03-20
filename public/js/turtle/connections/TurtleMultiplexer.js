import { TurtleBranch } from '../TurtleBranch.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { OpaqueUint8ArrayStorage } from './OpaqueUint8ArrayStorage.js'

export class TurtleMultiplexer extends TurtleDictionary {
  constructor (name, recaller, u8aTurtle) {
    super(name, recaller, u8aTurtle)
    this.incomingBranch = new TurtleBranch(`${name}.incomingBranch`)
    this.outgoingBranch = new TurtleBranch(`${name}.outgoingBranch`)
    this.duplex = {
      readableStream: this.outgoingBranch.makeReadableStream(),
      writableStream: this.incomingBranch.makeWritableStream()
    }
    this.opaqueUint8ArrayStorage = OpaqueUint8ArrayStorage.fromTurtleBranch(this)
  }

  /**
   * @param {Duplex} duplex
   */
  connect (duplex) {
    this.duplex.readableStream.pipeTo(duplex.writableStream)
    duplex.readableStream.pipeTo(this.duplex.writableStream)
  }
}
