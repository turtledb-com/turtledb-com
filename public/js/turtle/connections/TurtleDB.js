import { Recaller } from '../../utils/Recaller.js'
import { TurtleBranch } from '../TurtleBranch.js'

/**
 * @typedef {{turtleBranchPromise: Promise.<TurtleBranch>, publicKey: string, tags: Set.<string>}} BranchInfo
 * @typedef {(publicKey: string, name: string, turtleBranchSuggestion: TurtleBranch) => Promise.<TurtleBranch>} TurtleBranchGetter
 * @typedef {(next: TurtleBranchGetter, publicKey: string, name: string, turtleBranchSuggestion: TurtleBranch) => Promise.<TurtleBranch>} TurtleBranchStep
 */

const KEY_OR_TAG_CHANGE = Symbol('TurtleDB instance changed')

export class TurtleDB {
  /** @type {Object.<string, BranchInfo>} */
  #branchInfoByKey = {}
  /** @type {Array.<TurtleBranchStep>} */
  #turtleBranchSteps = [async (next, publicKey, name, turtleBranchSuggestion) => {
    if (!this.#branchInfoByKey[publicKey]) {
      // const turtleBranch = await next(publicKey, name, turtleBranchSuggestion)
      this.#branchInfoByKey[publicKey] = {
        turtleBranchPromise: next(publicKey, name, turtleBranchSuggestion),
        publicKey,
        tags: new Set()
      }
      this.recaller.reportKeyMutation(this, KEY_OR_TAG_CHANGE, '#turtleBranchSteps[0]', this.name)
    }
    return this.#branchInfoByKey[publicKey].turtleBranchPromise
  }]

  constructor (name, recaller = new Recaller(name)) {
    this.name = name
    this.recaller = recaller
  }

  /**
   * @param {TurtleBranchStep} step
   */
  addTurtleBranchStep (step) {
    if (this.#turtleBranchSteps.includes(step)) return console.warn('step already added')
    this.#turtleBranchSteps.push(step)
  }

  removeTurtleBranchStep (step) {
    if (!this.#turtleBranchSteps.includes(step)) return console.warn('step already removed')
    this.#turtleBranchSteps = this.#turtleBranchSteps.filter(_step => _step !== step)
  }

  /**
   * @param {string} publicKey
   * @param {string} name
   * @param {TurtleBranch} turtleBranchSuggestion
   * @returns {Promise.<TurtleBranch>}
   */
  async getTurtleBranch (publicKey, name = publicKey, turtleBranchSuggestion) {
    this.recaller.reportKeyAccess(this, KEY_OR_TAG_CHANGE, 'getTurtleBranch', this.name)
    let i = 0
    /** @type {(j: number) => TurtleBranchStep} */
    const next = j => (publicKey, name, turtleBranchSuggestion) => {
      if (i !== j) console.error('turtleBranchSteps called out of order')
      if (j >= this.#turtleBranchSteps.length) return turtleBranchSuggestion ?? new TurtleBranch(name)
      ++i
      return this.#turtleBranchSteps[j](next(i), publicKey, name, turtleBranchSuggestion)
    }
    return next(i)(publicKey, name, turtleBranchSuggestion)
  }

  addTag (publicKey, tag) {
    if (!this.getTurtleBranchInfo(publicKey).tags.has(tag)) {
      this.getTurtleBranchInfo(publicKey).tags.add(tag)
      this.recaller.reportKeyMutation(this, KEY_OR_TAG_CHANGE, 'addTag', this.name)
    }
  }

  getTurtleBranchInfo (publicKey) {
    this.recaller.reportKeyAccess(this, KEY_OR_TAG_CHANGE, 'getTurtleBranch', this.name)
    return this.#branchInfoByKey[publicKey]
  }

  /**
   * @param {Set.<string>} tags
   */
  getPublicKeys (tags) {
    this.recaller.reportKeyAccess(this, KEY_OR_TAG_CHANGE, 'getPublicKeys', this.name)
    const allKeys = Object.keys(this.#branchInfoByKey)
    if (!tags) return allKeys
    return allKeys.filter(publicKey => {
      const branchInfo = this.#branchInfoByKey[publicKey]
      return tags.intersection(branchInfo.tags).size === tags.size
    })
  }
}
