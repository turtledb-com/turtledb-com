import { Recaller } from '../../utils/Recaller.js'
import { TurtleBranch } from '../TurtleBranch.js'

/**
 * @typedef {{turtleBranch: TurtleBranch, publicKey: string}} BranchInfo
 */

export class TurtleDB {
  /** @type {Object.<string, BranchInfo>} */
  #BranchInfoByPublicKey = {}
  #turtleBranchSteps = [async (next, publicKey, name, turtleBranchSuggestion) => {
    if (!this.#BranchInfoByPublicKey[publicKey]) {
      const turtleBranch = await next(publicKey, name, turtleBranchSuggestion) ?? turtleBranchSuggestion ?? new TurtleBranch(name)
      this.#BranchInfoByPublicKey[publicKey] = {
        turtleBranch,
        publicKey
      }
    }
    return this.#BranchInfoByPublicKey[publicKey]
  }]

  constructor (name, recaller = new Recaller(name)) {
    this.name = name
    this.recaller = recaller
  }

  addTurtleBranchStep (step) {
    if (this.#turtleBranchSteps.includes(step)) return console.warn('step already included')
    this.#turtleBranchSteps.push(step)
  }

  async getTurtleBranch (publicKey, name = publicKey, turtleBranchSuggestion) {
    let i = 0
    const next = j => (publicKey, name, turtleBranchSuggestion) => {
      if (i !== j) console.error('turtleBranchSteps called out of order')
      return this.#turtleBranchSteps[i](next(++i), publicKey, name, turtleBranchSuggestion)
    }
    return await next(i)(next, publicKey, name, turtleBranchSuggestion)
  }
}
