import { splitEncodedCommit } from '../codecs/codec.js'
import { U8aTurtle } from '../U8aTurtle.js'
import { combineUint8Arrays } from '../utils.js'

/**
 * @typedef {import('./OpaqueUint8ArrayStorage.js').OpaqueUint8ArrayStorage}
 */

/**
 * @typedef CommitAsRefs
 * @property {number} head
 * @property {number} body
 *
 * @typedef CommitsAsRefs
 * @type {Array.<CommitAsRefs}
 *
 * @typedef Commit
 * @property {Uint8Array} head
 * @property {Uint8Array} body
 *
 * @typedef Commits
 * @type {Array.<Commit>}
 */

export class VirtualCommits {
  /** @type {OpaqueUint8ArrayStorage} */
  #storage
  /** @type {CommitsAsRefs} */
  #commitsAsRefs
  /** @type {Commits} */
  #commits

  /**
   * @param {OpaqueUint8ArrayStorage} storage
   * @param {CommitAsRefs} [commitsAsRefs]
   * @param {Commits} [commits]
   */
  constructor (storage, commitsAsRefs = [], commits = []) {
    this.#storage = storage
    this.#commitsAsRefs = commitsAsRefs
    this.#commits = commits
    this.fixLength()
  }

  get length () {
    return Math.max(this.#commits.length, this.commitsAsRefs.length)
  }

  set length (length) {
    this.commitsAsRefs.length = length
    this.#commits.length = length
  }

  fixLength () {
    const length = this.length
    this.length = length
  }

  get commitsAsRefs () {
    return this.#commitsAsRefs
  }

  get index () {
    return this.length - 1
  }

  async getShownCommits () {
    return Object.keys(this.commitsAsRefs)
  }

  async getAvailableCommits () {
    Object.keys(Object.assign([], this.#commits, this.commitsAsRefs))
  }

  async getHead (index) {
    const commitAsRefs = this.commitsAsRefs[index]
    if (!commitAsRefs?.head && !this.#commits[index]?.head) return
    const commit = this.#commits[index] ??= {}
    commit.head ??= await this.#storage.lookup(commitAsRefs.head)
    return commit.head
  }

  async getBody (index) {
    const commitAsRefs = this.commitsAsRefs[index]
    if (!commitAsRefs?.body && !this.#commits[index]?.body) return
    const commit = this.#commits[index] ??= {}
    commit.body ??= await this.updateManifold.getOpaqueUint8Array(commitAsRefs.body)
    return commit.body
  }

  async showHeadRef (index) {
    const commitAsRefs = this.commitsAsRefs[index] ?? {}
    if (commitAsRefs?.head) return
    const commit = this.#commits[index]
    if (!commit?.head) throw new Error('no head available')
    commitAsRefs.head ??= this.#storage.upsert(commit.head)
    this.commitsAsRefs[index] = commitAsRefs
    this.fixLength()
  }

  async showRefs (index) {
    const commitAsRefs = this.commitsAsRefs[index] ?? {}
    if (commitAsRefs?.head && commitAsRefs?.body) return
    const commit = this.#commits[index]
    if (!commit?.head || !commit?.body) throw new Error('no commit available')
    commitAsRefs.head ??= this.#storage.upsert(commit.head)
    commitAsRefs.body ??= this.#storage.upsert(commit.body)
    this.commitsAsRefs[index] = commitAsRefs
    this.fixLength()
  }

  async getUint8Array (index) {
    const head = await this.getHead(index)
    const body = await this.getBody(index)
    if (!head || !body) return
    return combineUint8Arrays([body, head])
  }

  async setUint8Array (index, uint8Array) {
    if (this.#commits[index]) throw new Error('can only setUint8Arry once for each index')
    const [body, head] = splitEncodedCommit(new U8aTurtle(uint8Array))
    this.#commits[index] = { head, body }
    this.fixLength()
  }
}
