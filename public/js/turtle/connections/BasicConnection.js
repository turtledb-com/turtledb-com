import { Recaller } from '../../utils/Recaller.js'
import { OPAQUE_UINT8ARRAY, splitEncodedCommit } from '../codecs/codec.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { U8aTurtle } from '../U8aTurtle.js'
import { combineUint8Arrays, deepEqualUint8Arrays } from '../utils.js'

/**
 * @typedef {import('../../utils/Recaller.js').Recaller} Recaller
 */

/**
 * @typedef Duplex
 * @property {ReadableStream} readableStream
 * @property {WritableStream} writableStream
 *
 * @typedef OpaqueUint8ArrayStorage
 * @property {(Uint8Array) => number} set
 * @property {(number) => Uint8Array} get
 *
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
 *
 * @typedef BaleUpdate
 * @property {string} defaultCpk
 * @property {Array.<string>} availableBranches
 * @property {Object.<string, number>} commitsAsRefsAddresses
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
  #updates = { hostUpdates: {}, index: 0 }
  /** @type {TurtleDictionary} */
  #dictionary
  /** @type {TurtleBranch} */
  outgoingBranch
  /** @type {TurtleBranch} */
  incomingBranch

  /**
   * @param {string} name
   */
  constructor (name) {
    this.name = name
    this.incomingBranch = new TurtleBranch(`${name}.incomingBranch`)
    this.outgoingBranch = new TurtleBranch(`${name}.outgoingBranch`)
    this.#dictionary = new TurtleDictionary(`${name}.dictionary`)
    this.duplex = {
      readableStream: this.outgoingBranch.makeReadableStream(),
      writableStream: this.incomingBranch.makeWritableStream()
    }
  }

  /**
   * @param {Duplex} duplex
   */
  connect (duplex) {
    this.duplex.readableStream.pipeTo(duplex.writableStream)
    duplex.readableStream.pipeTo(this.duplex.writableStream)
  }

  getOpaqueUint8Array (address) {
    return this.#dictionary.lookup(address)
  }

  setOpaqueUint8Array (uint8Array) {
    return this.#dictionary.upsert(uint8Array, [OPAQUE_UINT8ARRAY])
  }

  /**
   * @param {BranchUpdate} branchUpdate
   */
  setBranchUpdate (hostname, balename, cpk, branchUpdate) {
    const hostUpdates = this.#updates.hostUpdates
    hostUpdates[hostname] ??= { baleUpdates: {} }
    const baleUpdates = hostUpdates[hostname].baleUpdates
    baleUpdates[balename] ??= { commitsAsRefsAddresses: {} }
    const commitsAsRefsAddresses = baleUpdates[balename].commitsAsRefsAddresses
    if (Object.hasOwn(commitsAsRefsAddresses, cpk)) throw new Error(`BranchUpdate already exists at ${JSON.stringify({ hostname, balename, cpk })}`)
    /** @type {Updates} */
    const lastIncomingUpdates = this.incomingBranch.lookup()
    let lastIncomingAddress = lastIncomingUpdates?.hostUpdates?.[hostname]?.baleUpdates?.[balename]?.commitsAsRefsAddresses?.[cpk]
    this.incomingBranch.recaller.watch(`${branchUpdate.name}.incomingBranch`, () => {
      /** @type {Updates} */
      const newIncomingUpdates = this.incomingBranch.lookup()
      const newIncomingAddress = newIncomingUpdates?.hostUpdates?.[hostname]?.baleUpdates?.[balename]?.commitsAsRefsAddresses?.[cpk]
      if (newIncomingAddress !== lastIncomingAddress) {
        const commitsAsRefs = this.incomingBranch.lookup(newIncomingAddress)
        const stubBranchUpdate = new BranchUpdate('stubBranchUpdate', {
          getOpaqueUint8Array: address => this.incomingBranch.lookup(address),
          setOpaqueUint8Array: () => { throw new Error('trying to setOpaqueUint8Array of stubUpdateManifold') },
          setBranchUpdate: () => {}
        }, undefined, undefined, cpk, balename, hostname, commitsAsRefs)
        branchUpdate.combine(stubBranchUpdate)
        lastIncomingAddress = newIncomingAddress
      }
    })
    let lastOutgoingAddress
    branchUpdate.recaller.watch(branchUpdate.name, () => {
      const newOutgoingAddress = this.#dictionary.upsert(branchUpdate.commitsAsRefs)
      if (newOutgoingAddress !== lastOutgoingAddress) {
        commitsAsRefsAddresses[cpk] = newOutgoingAddress
        lastOutgoingAddress = newOutgoingAddress
        ++this.#updates.index
        this.#updates.ts = new Date()
        this.#dictionary.upsert(this.#updates)
        this.#dictionary.squash((this.outgoingBranch.index ?? -1) + 1)
        this.outgoingBranch.append(this.#dictionary.u8aTurtle.uint8Array)
      }
    })
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
  constructor (name, updateManifold, recaller = new Recaller(name), trusted = false, cpk = name, balename = cpk, hostname = 'turtledb.com', commitsAsRefs = []) {
    this.name = name
    this.updateManifold = updateManifold
    this.recaller = recaller
    this.cpk = cpk
    this.balename = balename
    this.hostname = hostname
    this.trusted = trusted
    this.#commits = []
    this.#commitsAsRefs = commitsAsRefs
    updateManifold.setBranchUpdate(hostname, balename, cpk, this)
  }

  get commitsAsRefs () {
    this.recaller.reportKeyAccess(this, 'commitsAsRefs', 'get', this.name)
    return this.#commitsAsRefs
  }

  get length () {
    return this.#commits.length
  }

  get index () {
    return this.commitsAsRefs.length - 1
  }

  async truncate (index) {
    if (this.#commits.length === index) return
    this.#commits.splice(index)
    if (!this.#commitsAsRefs.length) return
    this.#commitsAsRefs.splice(index)
    this.recaller.reportKeyMutation(this, 'commitsAsRefs', 'truncate', this.name)
  }

  async getShownCommits () {
    return Object.keys(this.commitsAsRefs)
  }

  async getHead (index) {
    if (!this.commitsAsRefs[index]?.head && !this.#commits[index]?.head) return
    this.#commits[index] ??= {}
    this.#commits[index].head ??= await this.updateManifold.getOpaqueUint8Array(this.#commitsAsRefs[index].head)
    return this.#commits[index].head
  }

  async getBody (index) {
    if (!this.commitsAsRefs[index]?.body && !this.#commits[index]?.body) return
    this.#commits[index] ??= {}
    this.#commits[index].body ??= await this.updateManifold.getOpaqueUint8Array(this.#commitsAsRefs[index].body)
    return this.#commits[index].body
  }

  async showHeadRef (index) {
    const commitAsRefs = this.#commitsAsRefs[index] ?? {}
    if (commitAsRefs?.head) return
    const commit = this.#commits[index]
    if (!commit?.head) throw new Error('no head available')
    commitAsRefs.head ??= this.updateManifold.setOpaqueUint8Array(commit.head)
    this.#commitsAsRefs[index] = commitAsRefs
    this.#commitsAsRefs.length = this.#commits.length
    this.recaller.reportKeyMutation(this, 'commitsAsRefs', 'showHeadRef', this.name)
  }

  async showCommitRefs (index) {
    const commitAsRefs = this.#commitsAsRefs[index] ?? {}
    if (commitAsRefs?.head && commitAsRefs?.body) return
    const commit = this.#commits[index]
    if (!commit?.head || !commit?.body) throw new Error('no commit available')
    commitAsRefs.head ??= this.updateManifold.setOpaqueUint8Array(commit.head)
    commitAsRefs.body ??= this.updateManifold.setOpaqueUint8Array(commit.body)
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
    if (this.#commitsAsRefs.length || this.#commitsAsRefs.length === this.#commits.length) return
    this.#commitsAsRefs.length = this.#commits.length
    if (this.lastThat?.index < index) {
      this.showCommitRefs(index)
    }
    this.recaller.reportKeyMutation(this, 'commitsAsRefs', 'setUint8Array', this.name)
  }

  async toString () {
    return JSON.stringify({ name: this.name, length: this.length, index: this.index, shownCommits: await this.getShownCommits(), '#commitsAsRefs': this.#commitsAsRefs })
  }

  /**
   * @param {BranchUpdate} that
   */
  async combine (that) {
    this.lastThat = that
    console.log('\n\n incoming', await that.toString())
    console.log('        +', await this.toString())
    // 1st handle any conflicts
    if (this.index >= 0 && that.index >= 0) {
      for (const index of await this.getShownCommits()) {
        const i = +index
        if (!deepEqualUint8Arrays(await this.getHead(i), await that.getHead(i))) {
          console.error('incoming conflict', { i, cpk: this.cpk, trusted: this.trusted })
          if (this.trusted) await that.truncate(i)
          else await this.truncate(i)
          break
        }
      }
    }
    // 2nd copy new Commits from that
    for (const index of await that.getShownCommits()) {
      if (+index === this.length) {
        await this.setUint8Array(this.length, await that.getUint8Array(this.length))
      }
    }
    // 3rd write out new Commits for that
    for (let index = that.index + 1; index <= this.length - 1; ++index) {
      await this.showCommitRefs(index)
    }
    // 4th send signature for that current index // shows this's interest and lets that check for conflicts
    if (this.length && that.index !== -1 && this.length > that.index) {
      await this.showHeadRef(that.index)
    }
    console.log('        =', await this.toString())
  }
}
