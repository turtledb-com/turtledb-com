import { logDebug, logError, logWarn } from '../../utils/logger.js'
import { Recaller } from '../../utils/Recaller.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { Workspace } from '../Workspace.js'

/**
 * @typedef {import('../Signer.js').Signer} Signer
 * @typedef {(turtleBranchStatus) => Promise.<void>} Binding
 * @typedef {{
 *   turtleBranchPromise: Promise.<TurtleBranch>,
 *   publicKey: string,
 *   tags: Set.<any>,
 *   turtleBranch: TurtleBranch,
 *   bindingInProgress: Binding,
 *   bindings: Set.<Binding>
 * }} TurtleBranchStatus
 */

const STATUSES_OWN_KEYS = Symbol('TurtleDB instance changed')

export class TurtleDB {
  /** @type {Object.<string, TurtleBranchStatus>} */
  #statuses = {}
  /** @type {Array.<Binding>} */
  #bindings = []

  /**
   * @param {string} name
   * @param {Recaller} recaller
   */
  constructor (name, recaller = new Recaller(name)) {
    this.name = name
    this.recaller = recaller
  }

  /**
   * @param {Signer} signer
   * @param {string} name
   */
  async makeWorkspace (signer, name) {
    try {
      const { publicKey } = await signer.makeKeysFor(name)
      logDebug(() => console.log({ publicKey }))
      const turtleBranch = await this.summonBoundTurtleBranch(publicKey, name)
      return new Workspace(name, signer, this.recaller, turtleBranch)
    } catch (error) {
      logError(() => console.error(error))
    }
  }

  /**
   * get a TurtleBranch and init if required
   * @param {string} publicKey
   * @param {string} [name=publicKey]
   * @return {Promise.<TurtleBranch>}
   */
  async summonBoundTurtleBranch (publicKey, name = publicKey) {
    if (!publicKey) throw new Error('TurtleBranch must have publicKey')
    const status = this.getStatus(publicKey, name)
    if (status.turtleBranch.name === publicKey) status.turtleBranch.name = name
    return status.turtleBranchPromise
  }

  /**
   * @param {Binding} binding
   * @returns {boolean}
   */
  bind (binding) {
    if (this.#bindings.includes(binding)) {
      logWarn(() => console.warn('binding already added'))
      return false
    }
    this.#bindings.push(binding)
    return true
  }

  /**
   * @param {Binding} binding
   * @returns {boolean}
   */
  unbind (binding) {
    if (!this.#bindings.includes(binding)) {
      logWarn(() => console.warn('binding already removed'))
      return false
    }
    this.#bindings = this.#bindings.filter(_binding => _binding !== binding)
    return true
  }

  /**
   * @param {string} publicKey
   * @param {string} tag
   * @returns {boolean}
   */
  tag (publicKey, tag) {
    if (!this.getStatus(publicKey).tags.has(tag)) {
      this.getStatus(publicKey).tags.add(tag)
      this.recaller.reportKeyMutation(this, STATUSES_OWN_KEYS, 'tag', this.name)
      return true
    }
    return false
  }

  /**
   * @param {string} publicKey
   * @param {string} tag
   * @returns {boolean}
   */
  untag (publicKey, tag) {
    if (this.getStatus(publicKey).tags.has(tag)) {
      this.getStatus(publicKey).tags.delete(tag)
      this.recaller.reportKeyMutation(this, STATUSES_OWN_KEYS, 'untag', this.name)
      return true
    }
    return false
  }

  /**
   * @param {string} publicKey
   * @returns {TurtleBranchStatus}
   */
  getStatus (publicKey, name = publicKey) {
    this.recaller.reportKeyAccess(this, STATUSES_OWN_KEYS, 'getStatus', this.name)
    let status = this.#statuses[publicKey]
    if (!status) {
      const turtleBranch = new TurtleBranch(name, this.recaller)
      status = {
        publicKey,
        tags: new Set(),
        turtleBranch,
        bindingInProgress: null,
        bindings: new Set()
      }
      this.#statuses[publicKey] = status
      this.recaller.reportKeyMutation(this, STATUSES_OWN_KEYS, 'getStatus', this.name)
      status.turtleBranchPromise = (async () => {
        try {
          for (const binding of this.#bindings) {
            status.bindingInProgress = binding
            await binding(status)
            status.bindings.add(binding)
          }
          return turtleBranch
        } catch (error) {
          logError(() => console.error(error))
        }
      })()
    }
    return this.#statuses[publicKey]
  }

  /**
   * @param {Set.<string>} tags
   * @returns {Array.<string>}
   */
  getPublicKeys (tags) {
    this.recaller.reportKeyAccess(this, STATUSES_OWN_KEYS, 'getPublicKeys', this.name)
    const allKeys = Object.keys(this.#statuses)
    if (!tags) return allKeys
    return allKeys.filter(publicKey => {
      const status = this.#statuses[publicKey]
      return tags.intersection(status.tags).size === tags.size
    })
  }
}
