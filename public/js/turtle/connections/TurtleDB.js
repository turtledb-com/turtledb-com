import { Recaller } from '../../utils/Recaller.js'
import { TurtleBranch } from '../TurtleBranch.js'

/**
 * @typedef {{turtleBranchPromise: Promise.<TurtleBranch>, publicKey: string, tags: Set.<string>, existingTurtleBranch: TurtleBranch}} BranchInfo
 * @typedef {(publicKey: string, name: string, existingTurtleBranch: TurtleBranch) => Promise.<TurtleBranch>} TurtleBranchGetter
 * @typedef {(next: TurtleBranchGetter, publicKey: string, name: string, existingTurtleBranch: TurtleBranch) => Promise.<TurtleBranch>} TurtleBranchStep
 */

/**
 * @typedef {{
 *   turtleBranchPromise: Promise.<TurtleBranch>,
 *   publicKey: string,
 *   tags: Set.<any>,
 *   turtleBranch: TurtleBranch,
 *   bindingInProgress: Binding,
 *   bindings: Set.<Binding>
 * }} TurtleBranchStatus
 * @typedef {(turtleBranchStatus) => Promise.<void>} Binding
 */

const STATUSES_OWN_KEYS = Symbol('TurtleDB instance changed')

export class TurtleDB {
  /** @type {Object.<string, TurtleBranchStatus>} */
  #statuses = {}
  /** @type {Array.<Binding>} */
  #bindings = []

  constructor (name, recaller = new Recaller(name)) {
    this.name = name
    this.recaller = recaller
  }

  /**
   * @param {Binding} binding
   */
  bind (binding) {
    if (this.#bindings.includes(binding)) return console.warn('binding already added')
    this.#bindings.push(binding)
  }

  /**
   * @param {Binding} binding
   */
  unbind (binding) {
    if (!this.#bindings.includes(binding)) return console.warn('binding already removed')
    this.#bindings = this.#bindings.filter(_binding => _binding !== binding)
  }

  tag (publicKey, tag) {
    if (!this.getStatus(publicKey).tags.has(tag)) {
      this.getStatus(publicKey).tags.add(tag)
      this.recaller.reportKeyMutation(this, STATUSES_OWN_KEYS, 'tag', this.name)
    }
  }

  untag (publicKey, tag) {
    if (this.getStatus(publicKey).tags.has(tag)) {
      this.getStatus(publicKey).tags.delete(tag)
      this.recaller.reportKeyMutation(this, STATUSES_OWN_KEYS, 'untag', this.name)
    }
  }

  /**
   * get a TurtleBranch and init if required
   * @param {string} publicKey
   * @param {string} [name=publicKey]
   * @param {Set<any>} [tags=new Set()]
   * @return {Promise.<TurtleBranch>}
   */
  async summonBoundTurtleBranch (publicKey, name = publicKey, tags = new Set()) {
    if (!publicKey) throw new Error('TurtleBranch must have publicKey')
    let status = this.#statuses[publicKey]
    if (!status) {
      const turtleBranch = new TurtleBranch(name)
      status = {
        publicKey,
        tags,
        turtleBranch,
        bindingInProgress: null,
        bindings: new Set()
      }
      status.turtleBranchPromise = (async () => {
        for (const binding of this.#bindings) {
          console.log(binding)
          status.bindingInProgress = binding
          await binding(status)
          status.bindings.add(binding)
        }
        return turtleBranch
      })()
      this.#statuses[publicKey] = status
    } else {
      status.tags = status.tags.union(tags)
    }
    this.recaller.reportKeyMutation(this, STATUSES_OWN_KEYS, 'summonBoundTurtleBranch', this.name)
    return status.turtleBranchPromise
  }

  getStatus (publicKey) {
    this.recaller.reportKeyAccess(this, STATUSES_OWN_KEYS, 'buildTurtleBranch', this.name)
    return this.#statuses[publicKey]
  }

  /**
   * @param {Set.<string>} tags
   */
  getPublicKeys (tags) {
    this.recaller.reportKeyAccess(this, STATUSES_OWN_KEYS, 'getPublicKeys', this.name)
    const allKeys = Object.keys(this.#statuses)
    if (!tags) return allKeys
    return allKeys.filter(publicKey => {
      const branchInfo = this.#statuses[publicKey]
      return tags.intersection(branchInfo.tags).size === tags.size
    })
  }
}
