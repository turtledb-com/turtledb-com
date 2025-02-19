import { IGNORE_MUTATE } from '../utils/Recaller.js'
import { codec, COMMIT, splitEncodedCommit } from './codecs/codec.js'
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
    branch.recaller.watch(`update Workspace:${name}`, () => {
      if (this.branch.u8aTurtle === this.u8aTurtle) return
      let lastLength = this.length
      if (this.branch.u8aTurtle && this.u8aTurtle) {
        if (this.u8aTurtle.findParentByIndex(this.branch.index) === this.branch.u8aTurtle) return
        if (this.branch.u8aTurtle.findParentByIndex(this.index) !== this.u8aTurtle) {
          lastLength = 0
        }
      }
      this.u8aTurtle = this.branch.u8aTurtle
      this.lexicograph(lastLength)
    })
  }

  get lastCommit () { return this.lookup()?.value }
  get lastCommitValue () { return this.lastCommit?.value }

  async commit (value, message) {
    console.log(this.name, 'commit', { message })
    if (this.u8aTurtle && this.branch.u8aTurtle !== this.u8aTurtle.findParentByIndex(this.branch.index)) {
      throw new Error('target must be ancestor of updates (merge required)')
    }
    const ts = new Date()
    let address
    this.recaller.call(() => {
      address = this.upsert({
        message,
        name: this.name,
        username: this.signer.username,
        ts,
        value
      })
    }, IGNORE_MUTATE)
    const uint8Arrays = this.u8aTurtle.exportUint8Arrays((this.branch.index ?? -1) + 1)
    const combinedNewUint8Array = combineUint8Arrays(uint8Arrays)
    if (this.branch.u8aTurtle) {
      const previousEncodedCommit = splitEncodedCommit(this.branch.u8aTurtle)[1]
      uint8Arrays.unshift(previousEncodedCommit)
    }
    const signature = await this.signer.sign(this.branch.name, combineUint8Arrays(uint8Arrays))
    const commit = new Commit(address, signature)
    const encodedCommit = codec.encodeValue(commit, [codec.getCodecType(COMMIT)], null, AS_REFS)
    this.branch.append(combineUint8Arrays([combinedNewUint8Array, encodedCommit.uint8Array]))
    this.u8aTurtle = this.branch.u8aTurtle
  }
}
