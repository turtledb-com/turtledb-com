import { IGNORE_MUTATE, Recaller } from '../utils/Recaller.js'
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
      console.log(this.u8aTurtle, this.committedBranch.u8aTurtle)
      this.u8aTurtle = this.committedBranch.u8aTurtle
      this.lexicograph()
    })
  }

  get lastCommit () { return this.committedBranch.lookup()?.value }
  get lastCommitValue () { return this.lastCommit?.value }

  async #queueCommit (value, message, lastQueuedCommit) {
    await lastQueuedCommit
    if (this.u8aTurtle && !this.u8aTurtle.hasAncestor(this.committedBranch.u8aTurtle)) {
      throw new Error('committedBranch must be ancestor of workspace (merge required)')
    }
    const address = this.recaller.call(() => this.upsert({
      message,
      name: this.name,
      username: this.signer.username,
      ts: new Date(),
      value
    }), IGNORE_MUTATE)
    this.append(await this.signer.signCommit(this.name, address, this.u8aTurtle, this.committedBranch.u8aTurtle))
    this.squash((this.committedBranch?.index ?? -1) + 1)
    this.committedBranch.u8aTurtle = this.u8aTurtle
  }

  async commit (value, message) {
    console.log(this.name, 'commit', { message })
    this._queuedCommit = this.#queueCommit(value, message, this._queuedCommit)
    await this._queuedCommit
  }
}
