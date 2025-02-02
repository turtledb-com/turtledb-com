import { codec, COMMIT } from './codecs/codec.js'
import { AS_REFS } from './codecs/CodecType.js'
import { Commit } from './codecs/Commit.js'
import { TurtleDictionary } from './TurtleDictionary.js'
import { combineUint8Arrays } from './utils.js'

export class Workspace extends TurtleDictionary {
  /**
   * @param {import('./Signer.js').Signer} signer
   * @param {string} name
   * @param {import('./TurtleBranch.js').TurtleBranch} branch
   */
  constructor (signer, name, branch) {
    super(name, branch.recaller, branch.u8aTurtle)
    this.signer = signer
    this.branch = branch
    branch.recaller.watch(`update ${name}`, () => {
      if (this.branch.u8aTurtle === this.u8aTurtle) return
      if (this.branch.u8aTurtle && this.u8aTurtle) {
        if (this.u8aTurtle.findParentByIndex(this.branch.index) === this.branch.u8aTurtle) return
        if (this.branch.u8aTurtle.findParentByIndex(this.index) !== this.u8aTurtle) {
          throw new Error(`${this.name} must be ancestor of branch (merge required)`)
        }
      }
      const lastLength = this.length
      this.u8aTurtle = this.branch.u8aTurtle
      this.lexicograph(lastLength)
    })
  }

  get lastCommit () { return this.lookup()?.value }
  get lastCommitValue () { return this.lastCommit?.value }

  async commit (value, message) {
    if (this.u8aTurtle && this.branch.u8aTurtle !== this.u8aTurtle.findParentByIndex(this.branch.index)) {
      throw new Error('target must be ancestor of updates (merge required)')
    }
    const ts = new Date()
    const address = this.upsert({
      message,
      name: this.name,
      username: this.signer.username,
      ts,
      value
    })
    const uint8Array = combineUint8Arrays(this.u8aTurtle.exportUint8Arrays((this.branch.index ?? -1) + 1))
    let signature
    if (this.branch.u8aTurtle) {
      /** @type {Commit} */
      const previousCommit = this.branch.lookup(AS_REFS)
      if (!(previousCommit instanceof Commit)) {
        throw new Error('previous last value must be a Commit')
      }
      signature = await this.signer.sign(this.branch.name, combineUint8Arrays([previousCommit.signature, uint8Array]))
    } else {
      signature = await this.signer.sign(this.branch.name, uint8Array)
    }
    const commit = new Commit(address, signature)
    const encodedCommit = codec.encodeValue(commit, [codec.getCodecType(COMMIT)], null, AS_REFS)
    this.branch.append(combineUint8Arrays([uint8Array, encodedCommit.uint8Array]))
    this.u8aTurtle = this.branch.u8aTurtle
  }
}
