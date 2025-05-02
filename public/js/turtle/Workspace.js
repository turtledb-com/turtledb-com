import { IGNORE_MUTATE, Recaller } from '../utils/Recaller.js'
import { AS_REFS } from './codecs/CodecType.js'
import { TurtleBranch } from './TurtleBranch.js'
import { TurtleDictionary } from './TurtleDictionary.js'

/**
 * @typedef {import('./Signer.js').Signer} Signer
 * @typedef {import('./TurtleBranch.js').TurtleBranch} TurtleBranch
 */

export class Workspace extends TurtleDictionary {
  /**
   * @param {string} name
   * @param {Signer} signer
   * @param {TurtleBranch} [committedBranch=new TurtleBranch(`${name}.committedBranch`)]
   * @param {Recaller} [recaller=new Recaller(name)]
   */
  constructor (name, signer, committedBranch = new TurtleBranch(`${name}.committedBranch`), recaller = new Recaller(name)) {
    super(name, recaller, committedBranch.u8aTurtle)
    this.signer = signer
    this.committedBranch = committedBranch
    this.committedBranch.recaller.watch(`update Workspace:${this.name}`, () => {
      if (this.committedBranch.u8aTurtle === this.u8aTurtle) return
      if (this.committedBranch.u8aTurtle && this.u8aTurtle) {
        if (this.u8aTurtle.hasAncestor(this.committedBranch.u8aTurtle)) return // uncommitted changes
      }
      this.u8aTurtle = this.committedBranch.u8aTurtle
      this.lexicograph()
    })
  }

  get lastCommit () { return this.committedBranch.lookup()?.document }
  get lastCommitValue () { return this.lastCommit?.value }

  async #queueCommit (value, message, asRef, lastQueuedCommit) {
    await lastQueuedCommit
    if (this.u8aTurtle && !this.u8aTurtle.hasAncestor(this.committedBranch.u8aTurtle)) {
      throw new Error('committedBranch must be ancestor of workspace (merge required)')
    }

    const address = this.recaller.call(() => this.upsert({
      message: this.upsert(message),
      name: this.upsert(this.name),
      username: this.upsert(this.signer.username),
      ts: this.upsert(new Date()),
      value: asRef ? value : this.upsert(value)
    }, undefined, AS_REFS), IGNORE_MUTATE)
    this.append(await this.signer.signCommit(this.name, address, this.u8aTurtle, this.committedBranch.u8aTurtle))
    this.squash((this.committedBranch?.index ?? -1) + 1)
    this.committedBranch.u8aTurtle = this.u8aTurtle
    return this
  }

  async commit (value, message, asRef = false) {
    this._queuedCommit = this.#queueCommit(value, message, asRef, this._queuedCommit)
    return this._queuedCommit
  }
}
