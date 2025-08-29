import { IGNORE_MUTATE, Recaller } from '../utils/Recaller.js'
import { AS_REFS } from './codecs/CodecType.js'
import { TurtleBranch } from './TurtleBranch.js'
import { TurtleDictionary } from './TurtleDictionary.js'
import { JSON_FILE, pathToType, TEXT_FILE } from '../utils/fileTransformer.js'
import { ATOMIC_UINT8ARRAY } from './codecs/codec.js'

/**
 * @typedef {import('./Signer.js').Signer} Signer
 * @typedef {import('./TurtleBranch.js').TurtleBranch} TurtleBranch
 */

export class Workspace extends TurtleDictionary {
  /**
   * @param {string} name
   * @param {Signer} signer
   * @param {Recaller} [recaller=new Recaller(name)]
   * @param {TurtleBranch} [committedBranch=new TurtleBranch(`${name}.committedBranch`, recaller)]
   */
  constructor (name, signer, recaller = new Recaller(name), committedBranch = new TurtleBranch(`${name}.committedBranch`, recaller)) {
    super(name, recaller, committedBranch.u8aTurtle)
    this.signer = signer
    this.committedBranch = committedBranch
    this.committedBranch.recaller.watch(`update Workspace with committed changes:${this.name}`, () => {
      if (!this.committedBranch.u8aTurtle) return
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
    const valueRef = asRef ? value : this.upsert(value)
    const address = this.recaller.call(() => {
      return this.upsert({
        message: this.upsert(message),
        name: this.upsert(this.name),
        username: this.upsert(this.signer.username),
        ts: this.upsert(new Date()),
        value: valueRef
      }, undefined, AS_REFS)
    }, IGNORE_MUTATE)
    this.append(await this.signer.signCommit(this.name, address, this.u8aTurtle, this.committedBranch.u8aTurtle))
    this.squash((this.committedBranch?.index ?? -1) + 1)
    this.committedBranch.u8aTurtle = this.u8aTurtle
    return this
  }

  async commit (value, message, asRef = typeof value === 'number') {
    if (asRef && typeof value !== 'number') throw new Error(`commit asRef must be number, received ${typeof value}`)
    this._queuedCommit = this.#queueCommit(value, message, asRef, this._queuedCommit)
    return this._queuedCommit
  }

  upsertFile (filename, content, valueAddress) {
    const type = pathToType(filename)
    let documentValueRefs
    if (valueAddress >= 0) {
      documentValueRefs = this.lookup(valueAddress, AS_REFS) || {}
    } else {
      documentValueRefs = this.committedBranch.lookup('document', 'value', AS_REFS) || {}
    }
    if (!content) {
      delete documentValueRefs[filename]
    } else {
      let address
      if (content instanceof Uint8Array) address = this.upsert(content, [ATOMIC_UINT8ARRAY])
      else if (typeof content === 'string') {
        if (type === JSON_FILE) address = this.upsert(JSON.parse(content))
        else if (type === TEXT_FILE) address = this.upsert(content.split('\n'))
        else throw new Error('unsupported file type')
      } else if (content && typeof content === 'object') address = this.upsert(content)
      else throw new Error('unsupported file type')
      documentValueRefs[filename] = address
    }
    return this.upsert(documentValueRefs, undefined, AS_REFS)
  }

  lookupFile (filename, asStored = false) {
    const type = pathToType(filename)
    const storedContent = this.lookup('document', 'value', filename)
    console.log({ storedContent, type })
    if (asStored || !storedContent) return storedContent
    if (storedContent instanceof Uint8Array) return storedContent
    if (type === JSON_FILE) return JSON.stringify(storedContent, null, 2)
    if (type === TEXT_FILE) return storedContent.join('\n')
    return undefined
  }
}
