import { Recaller } from '../../utils/Recaller.js'
import { codec, OPAQUE_UINT8ARRAY, splitEncodedCommit } from '../codecs/codec.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { U8aTurtle } from '../U8aTurtle.js'
import { combineUint8Arrays, compareUint8Arrays, cpkBaleHostToPath } from '../utils.js'

/**
 * @typedef {import('../../utils/Recaller.js').Recaller} Recaller
 */

/**
 * @typedef CommitAsRefs
 * @property {number} head
 * @property {number} body
 *
 * @typedef Commit
 * @property {Uint8Array} head
 * @property {Uint8Array} body
 *
 * @typedef BaleUpdate
 * @property {string} defaultCpk
 * @property {Array.<string>} availableBranches
 * @property {Object.<string, BranchUpdate>} branchUpdates
 *
 * @typedef HostUpdate
 * @property {string} defaultBale
 * @property {Object.<string, BaleUpdate>} baleUpdates
 *
 * @typedef Updates
 * @property {string} defaultHost
 * @property {Object.<string, HostUpdate>} hostUpdates
 */

export class UpdateManifold {
  /** @type {Updates} */
  #hostBaleCpk
  /** @type {TurtleDictionary} */
  dictionary
  /**
   * @param {string} name
   * @param {Recaller} recaller
   * @param {boolean} trusted
   */
  constructor (name, recaller, trusted) {
    this.name = name
    this.recaller = recaller
    this.trusted = trusted
    this.dictionary = new TurtleDictionary(`${this.name}.dictionary`, recaller)
    let lastIndex = this.dictionary.index ?? -1
    recaller.watch(`UpdateManifold ${this.name}`, () => {
      if (this.dictionary.index > lastIndex) {
        this.dictionary.squash(lastIndex + 1)
        lastIndex = this.dictionary.index
        console.log(name, lastIndex)
      }
    })
  }

  getUpdate (hostname, balename, cpk) {
    this.recaller.reportKeyAccess(this, cpkBaleHostToPath(hostname, balename, cpk))
    return this.#hostBaleCpk?.hostUpdates?.[hostname]?.baleUpdates?.[balename]?.branchUpdates?.[cpk]
  }

  /**
   * @param {string} hostname
   * @param {string} balename
   * @param {string} cpk
   * @param {BranchUpdate} branchUpdate
   */
  initUpdate (branchUpdate) {
    const { hostname, balename, cpk } = branchUpdate
    this.#hostBaleCpk ??= { hostUpdates: {} }
    this.#hostBaleCpk.hostUpdates[hostname] ??= { baleUpdates: {} }
    this.#hostBaleCpk.hostUpdates[hostname].baleUpdates[balename] ??= { branchUpdates: {} }
    if (this.#hostBaleCpk.hostUpdates[hostname].baleUpdates[balename].branchUpdates[cpk]) {
      throw new Error(`BranchUpdate already exists at ${cpkBaleHostToPath(cpk, balename, hostname)}`)
    }
    this.#hostBaleCpk.hostUpdates[hostname].baleUpdates[balename].branchUpdates[cpk] = branchUpdate
    const updates = { hostUpdates: {} }
    branchUpdate.recaller.watch(`${this.name} watching ${branchUpdate.name}`, () => {
      /** @type {Updates} */
      updates.hostUpdates[hostname] ??= { baleUpdates: {} }
      updates.hostUpdates[hostname].baleUpdates[balename] ??= { branchUpdates: {} }
      const commitsAddress = this.dictionary.upsert(branchUpdate.commits)
      if (updates.hostUpdates[hostname].baleUpdates[balename].branchUpdates[cpk] !== commitsAddress) {
        updates.hostUpdates[hostname].baleUpdates[balename].branchUpdates[cpk] = commitsAddress
        console.group(this.name)
        Object.values(updates.hostUpdates).forEach(hostUpdate => {
          Object.values(hostUpdate.baleUpdates).forEach(baleUpdate => {
            Object.entries(baleUpdate.branchUpdates).forEach(([name, branchUpdate]) => {
              console.log(name, this.dictionary.lookup(branchUpdate))
            })
          })
        })
        console.groupEnd()
        this.dictionary.upsert(updates)
      }
    })
    this.recaller.reportKeyAccess(this, cpkBaleHostToPath(hostname, balename, cpk))
  }
}

export class BranchUpdate {
  /** @type {Array.<Commit>} */
  #commits
  /** @type {Array.<CommitAsRefs>} */
  #commitsAsRefs
  /**
   * @param {string} name
   * @param {UpdateManifold} updateManifold
   * @param {Recaller} recaller
   * @param {string} cpk
   * @param {boolean} trusted
   * @param {BranchUpdate} init
   */
  constructor (name, updateManifold, recaller = new Recaller(name), trusted = false, cpk = name, balename = cpk, hostname = 'turtledb.com') {
    this.name = name
    this.updateManifold = updateManifold
    this.recaller = recaller
    this.cpk = cpk
    this.balename = balename
    this.hostname = hostname
    this.trusted = trusted
    this.#commits = []
    this.#commitsAsRefs = []
    updateManifold.initUpdate(this)
  }

  get commitsAsRefs () {
    this.recaller.reportKeyAccess(this, 'commitsAsRefs', 'get', this.name)
    return this.#commitsAsRefs
  }

  get length () {
    this.recaller.reportKeyAccess(this, 'commitsAsRefs', 'get_index', this.name)
    return this.#commits.length
  }

  get index () {
    this.recaller.reportKeyAccess(this, 'commitsAsRefs', 'get_index', this.name)
    return this.#commitsAsRefs.length - 1
  }

  set index (index) {
    this.recaller.reportKeyAccess(this, 'commitsAsRefs', 'set_index', this.name)
    this.#commitsAsRefs.length = index + 1
  }

  async truncate (index) {
    if (this.#commits.length === index) return
    this.#commits.splice(index)
    if (!this.#commitsAsRefs.length) return
    this.#commitsAsRefs.splice(index)
    this.recaller.reportKeyMutation(this, 'commitsAsRefs', 'truncate', this.name)
  }

  getAvailableCommits () {
    return new Set([...Object.keys(this.co)])
  }

  async getShownCommits () {
    return Object.keys(this.#commitsAsRefs)
  }

  async getHead (index) {
    if (!this.commitsAsRefs[index]?.head && !this.#commits[index]?.head) return
    this.#commits[index].head ??= await this.updateManifold.dictionary.lookup(this.#commitsAsRefs[index].head)
    return this.#commits[index].head
  }

  async getBody (index) {
    if (!this.commitsAsRefs[index]?.body && !this.#commits[index]?.body) return
    this.#commits[index].body ??= await this.updateManifold.dictionary.lookup(this.#commitsAsRefs[index].body)
    return this.#commits[index].body
  }

  async showHeadRef (index) {
    const commitAsRefs = this.#commitsAsRefs[index] ?? {}
    if (commitAsRefs?.head) return
    const commit = this.#commits[index]
    if (!commit?.head) throw new Error('no head available')
    commitAsRefs.head ??= this.updateManifold.dictionary.upsert(commit.head, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
    this.#commitsAsRefs[index] = commitAsRefs
    this.#commitsAsRefs.length = this.#commits.length
    this.recaller.reportKeyMutation(this, 'commitsAsRefs', 'showHeadRef', this.name)
  }

  async showCommitRefs (index) {
    const commitAsRefs = this.#commitsAsRefs[index] ?? {}
    if (commitAsRefs?.head && commitAsRefs?.body) return
    const commit = this.#commits[index]
    if (!commit?.head || !commit?.body) throw new Error('no commit available')
    commitAsRefs.head ??= this.updateManifold.dictionary.upsert(commit.head, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
    commitAsRefs.body ??= this.updateManifold.dictionary.upsert(commit.body, [codec.getCodecType(OPAQUE_UINT8ARRAY)])
    this.#commitsAsRefs[index] = commitAsRefs
    this.#commitsAsRefs.length = this.#commits.length
    this.recaller.reportKeyMutation(this, 'commitsAsRefs', 'showCommitRefs', this.name)
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
    if (!this.#commitsAsRefs.length) return
    this.recaller.reportKeyMutation(this, 'commitsAsRefs', 'setUint8Array', this.name)
  }

  async toString () {
    return JSON.stringify({ name: this.name, length: this.length, index: this.index, commits: await this.getShownCommits(), '#commits': this.#commitsAsRefs })
  }

  /**
   * @param {BranchUpdate} that
   */
  async combine (that) {
    console.log('\n\n incoming', await that.toString())
    console.log('        +', await this.toString())
    // 1st handle any conflicts
    if (this.index >= 0 && that.index >= 0) {
      for (const index of await this.getShownCommits()) {
        const i = +index
        if (!compareUint8Arrays(await this.getHead(i), await that.getHead(i))) {
          console.error('incoming conflict', { i, cpk: this.cpk, trusted: this.trusted })
          if (this.trusted) await that.truncate(i)
          else await this.truncate(i)
          break
        }
      }
      if (this.index >= that.index) {
        // 2nd send signature for their current index
        await this.showHeadRef(that.index)
      }
    }
    // 3rd copy new Commits from that
    for (const index of await that.getShownCommits()) {
      if (+index === this.length) {
        await this.setUint8Array(this.length, await that.getUint8Array(this.length))
      }
    }
    // 4th write out new Commits for that
    for (let index = that.index + 1; index <= this.length - 1; ++index) {
      await this.showCommitRefs(index)
    }
    console.log('        =', await this.toString())
  }
}
