import { codecs, Commit, COMMIT } from './codecs.js'
import { TurtleBranch } from './TurtleBranch.js'

export class TurtleCommitter extends TurtleBranch {
  commit (address, uint8Array) {
    const signature = uint8Array
    codecs[COMMIT].encode(new Commit(address, signature))
  }
}
