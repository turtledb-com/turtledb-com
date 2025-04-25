import { Recaller } from '../../utils/Recaller.js'
import { TurtleBranch } from '../TurtleBranch.js'

/**
 * @typedef {{turtleBranchPromise: Promise.<TurtleBranch>, publicKey: string, tags: Set.<string>, existingTurtleBranch: TurtleBranch}} BranchInfo
 * @typedef {(publicKey: string, name: string, existingTurtleBranch: TurtleBranch) => Promise.<TurtleBranch>} TurtleBranchGetter
 * @typedef {(next: TurtleBranchGetter, publicKey: string, name: string, existingTurtleBranch: TurtleBranch) => Promise.<TurtleBranch>} TurtleBranchStep
 */

const KEY_OR_TAG_CHANGE = Symbol('TurtleDB instance changed')

export class TurtleDB {
  /** @type {Object.<string, BranchInfo>} */
  #branchInfoByKey = {}
  /** @type {Array.<TurtleBranchStep>} */
  #turtleBranchSteps = [async (next, publicKey, name) => {
    // console.log(publicKey)
    let tb
    if (!this.#branchInfoByKey[publicKey]) {
      const _turtleBranch = new TurtleBranch(name)
      tb = _turtleBranch
      this.#branchInfoByKey[publicKey] = {
        publicKey,
        tags: new Set(),
        existingTurtleBranch: _turtleBranch
      }
      this.#branchInfoByKey[publicKey].turtleBranchPromise = next(publicKey, name, _turtleBranch)
      this.recaller.reportKeyMutation(this, KEY_OR_TAG_CHANGE, '#turtleBranchSteps[0]', this.name)
    }
    const turtleBranch = await this.#branchInfoByKey[publicKey].turtleBranchPromise
    if (tb && tb !== turtleBranch) {
      throw new Error('?!')
    }
    return turtleBranch
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
   * @returns {Promise.<TurtleBranch>}
   */
  async buildTurtleBranch (publicKey, name = publicKey) {
    this.recaller.reportKeyAccess(this, KEY_OR_TAG_CHANGE, 'buildTurtleBranch', this.name)
    let i = 0
    /** @type {(j: number) => TurtleBranchStep} */
    const next = j => (publicKey, name, existingTurtleBranch) => {
      if (i !== j) console.error('turtleBranchSteps called out of order')
      if (j >= this.#turtleBranchSteps.length) return this.#branchInfoByKey[publicKey].existingTurtleBranch
      ++i
      return this.#turtleBranchSteps[j](next(i), publicKey, name, existingTurtleBranch)
    }
    return next(i)(publicKey, name)
  }

  addTag (publicKey, tag) {
    if (!this.getTurtleBranchInfo(publicKey).tags.has(tag)) {
      this.getTurtleBranchInfo(publicKey).tags.add(tag)
      this.recaller.reportKeyMutation(this, KEY_OR_TAG_CHANGE, 'addTag', this.name)
    }
  }

  getTurtleBranchInfo (publicKey) {
    this.recaller.reportKeyAccess(this, KEY_OR_TAG_CHANGE, 'buildTurtleBranch', this.name)
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
