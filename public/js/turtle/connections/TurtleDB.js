import { Recaller } from '../../utils/Recaller.js'
import { TurtleBranch } from '../TurtleBranch.js'

/**
 * @typedef {{turtleBranch: TurtleBranch, publicKey: string, tags: Set.<string>}} BranchInfo
 * @typedef {(publicKey: string, name: string, turtleBranchSuggestion: TurtleBranch) => Promise.<TurtleBranch>} TurtleBranchGetter
 * @typedef {(next: TurtleBranchGetter, publicKey: string, name: string, turtleBranchSuggestion: TurtleBranch) => Promise.<TurtleBranch>} TurtleBranchStep
 */

export class TurtleDB {
  /** @type {Object.<string, BranchInfo>} */
  #branchInfoByKey = {}
  /** @type {Array.<TurtleBranchStep>} */
  #turtleBranchSteps = [async (next, publicKey, name, turtleBranchSuggestion) => {
    if (!this.#branchInfoByKey[publicKey]) {
      const turtleBranch = await next(publicKey, name, turtleBranchSuggestion)
      this.#branchInfoByKey[publicKey] = {
        turtleBranch,
        publicKey,
        tags: new Set()
      }
    }
    return this.#branchInfoByKey[publicKey].turtleBranch
  }]

  constructor (name, recaller = new Recaller(name)) {
    this.name = name
    this.recaller = recaller
  }

  /**
   * @param {TurtleBranchStep} step
   */
  addTurtleBranchStep (step) {
    if (this.#turtleBranchSteps.includes(step)) return console.warn('step already included')
    this.#turtleBranchSteps.push(step)
  }

  /**
   * @param {string} publicKey
   * @param {string} name
   * @param {TurtleBranch} turtleBranchSuggestion
   * @returns {Promise.<TurtleBranch>}
   */
  async getTurtleBranch (publicKey, name = publicKey, turtleBranchSuggestion) {
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

  getTurtleBranchInfo (publicKey) {
    return this.#branchInfoByKey[publicKey]
  }

  /**
   * @param {Set.<string>} tags
   */
  getPublicKeys (tags) {
    const allKeys = Object.keys(this.#branchInfoByKey)
    if (!tags) return allKeys
    return allKeys.filter(publicKey => {
      const branchInfo = this.#branchInfoByKey[publicKey]
      return tags.intersection(branchInfo.tags).size === tags.size
    })
  }
}
