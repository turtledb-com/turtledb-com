import { IGNORE_MUTATE, Recaller } from '../utils/Recaller.js'
import { COMMIT, splitEncodedCommit } from './codecs/codec.js'
import { AS_REFS } from './codecs/CodecType.js'
import { Commit } from './codecs/Commit.js'
import { TurtleDictionary } from './TurtleDictionary.js'
import { combineUint8Arrays } from './utils.js'

export class Workspace extends TurtleDictionary {
  /**
   * @param {import('./Signer.js').Signer} signer
   * @param {string} name
   * @param {import('./TurtleBranch.js').TurtleBranch} committedBranch
   */
  constructor (signer, name, committedBranch, recaller = new Recaller(name)) {
    super(name, recaller, committedBranch.u8aTurtle)
    this.signer = signer
    this.committedBranch = committedBranch
    let lastLength = this.length
    this.committedBranch.recaller.watch(`update Workspace:${name}`, () => {
      if (this.committedBranch.u8aTurtle === this.u8aTurtle) return
      if (this.committedBranch.u8aTurtle && this.u8aTurtle) {
        if (this.u8aTurtle.hasAncestor(this.committedBranch.u8aTurtle)) return
        if (!this.committedBranch.u8aTurtle.hasAncestor(this.u8aTurtle)) {
          lastLength = 0 // reset and rerun lexicograph from 0 (zero causes reset)
        }
      }
      console.log('\nlastLength:', lastLength)
      console.log('\nthis.u8aTurtle:', this.u8aTurtle?.lookup?.())
      console.log('\nthis.branch.u8aTurtle:', this.committedBranch.u8aTurtle?.lookup?.())
      this.u8aTurtle = this.committedBranch.u8aTurtle
      this.lexicograph(lastLength)
      lastLength = this.length
    })
  }

  get lastCommit () { return this.committedBranch.lookup()?.value }
  get lastCommitValue () { return this.lastCommit?.value }

  async #commit (value, message, lastCommit) {
    await lastCommit
    console.log('starting', message)
    if (this.u8aTurtle && !this.u8aTurtle.hasAncestor(this.committedBranch.u8aTurtle)) {
      throw new Error('committedBranch must be ancestor of workspace (merge required)')
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
    const uint8Arrays = this.u8aTurtle.exportUint8Arrays((this.committedBranch.index ?? -1) + 1)
    if (this.committedBranch.u8aTurtle) {
      const previousEncodedCommit = splitEncodedCommit(this.committedBranch.u8aTurtle)[1]
      uint8Arrays.unshift(previousEncodedCommit)
    }
    const committedU8aTurtle = this.committedBranch.u8aTurtle
    const u8aTurtle = this.u8aTurtle
    const signature = await this.signer.sign(this.name, combineUint8Arrays(uint8Arrays))
    if (committedU8aTurtle !== this.committedBranch.u8aTurtle) throw new Error(`who moved my commits? -- ${this.name}`)
    if (u8aTurtle !== this.u8aTurtle) throw new Error(`who moved my workspace? -- ${this.name}`)
    const commit = new Commit(address, signature)
    this.upsert(commit, [COMMIT], AS_REFS)
    console.log(this.lookup())
    this.squash((this.committedBranch?.index ?? -1) + 1)
    this.committedBranch.u8aTurtle = this.u8aTurtle
    console.log('ending', message)
  }

  async commit (value, message) {
    console.log(this.name, 'commit', { message })
    this._commit = this.#commit(value, message, this._commit)
    await this._commit
  }
}
