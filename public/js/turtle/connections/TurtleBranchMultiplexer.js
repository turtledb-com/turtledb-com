import { OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { TurtleBranchUpdater } from './TurtleBranchUpdater.js'
import { TurtleTalker } from './TurtleTalker.js'

/**
 * @typedef {import('../U8aTurtle.js').U8aTurtle} U8aTurtle
 */

export class TurtleBranchMultiplexer extends TurtleTalker {
  /** @type {Object.<string, TurtleBranchUpdater>} */
  #updatersByCpk = {}

  /**
   * @param {string} name
   * @param {boolean} isTrusted
   * @param {Recaller} recaller
   */
  constructor (name, isTrusted, recaller) {
    super(name, isTrusted, recaller)
    this.outgoingDictionary = new TurtleDictionary(`TurtleBranchMultiplexer"${name}".outgoingDictionary`, recaller)
    let lastIndex = this.incomingBranch.index
    this.recaller.watch(`TurtleBranchMultiplexer"${name}"(distribute updates)`, () => {
      while (lastIndex < this.incomingBranch.index) {
        ++lastIndex
        const newU8aTurtle = this.incomingBranch.u8aTurtle.getAncestorByIndex(lastIndex)
        const { address, name, publicKey } = newU8aTurtle.lookup()
        // console.log(this.name, 'receiveUpdate', name, publicKey, address)
        const uint8Array = newU8aTurtle.lookup(address)
        const turtleBranchUpdater = this.getTurtleBranchUpdater(name, publicKey)
        turtleBranchUpdater.incomingBranch.append(uint8Array)
        // console.log(this.name, 'receiving', turtleBranchUpdater.incomingBranch.lookup())
      }
    })
  }

  /**
   * @param {Uint8Array} uint8Array
   * @param {string} name
   * @param {string} publicKey
   */
  sendUpdate (uint8Array, name, publicKey) {
    const address = this.outgoingDictionary.upsert(uint8Array, [OPAQUE_UINT8ARRAY])
    const update = { address, name, publicKey }
    // console.log(this.name, 'sendUpdate', update)
    this.outgoingDictionary.upsert(update)
    this.outgoingDictionary.squash(this.outgoingBranch.index + 1)
    this.outgoingBranch.u8aTurtle = this.outgoingDictionary.u8aTurtle
  }

  /**
   *
   * @param {string} name
   * @param {string} publicKey
   * @returns {TurtleBranchUpdater}
   */
  getTurtleBranchUpdater (name = '', publicKey = '', turtleBranch) {
    if (!this.#updatersByCpk[publicKey]) {
      turtleBranch ??= new TurtleBranch(name)
      const updater = new TurtleBranchUpdater(name, turtleBranch, publicKey, this.isTrusted)
      let lastIndex = -1
      updater.outgoingBranch.recaller.watch(`TBMux"${this.name}(${publicKey} ${name})`, () => {
        while (lastIndex < updater.outgoingBranch.index) {
          ++lastIndex
          const u8aTurtle = updater.outgoingBranch.u8aTurtle.getAncestorByIndex(lastIndex)
          // console.log(this.name, 'sending', u8aTurtle.lookup())
          this.sendUpdate(u8aTurtle.uint8Array, name, publicKey)
        }
      })
      this.#updatersByCpk[publicKey] = updater
    } else if (turtleBranch && this.#updatersByCpk[publicKey] !== turtleBranch) {
      throw new Error('trying to start existing updater with different turtle')
    }
    this.#updatersByCpk[publicKey].start()
    return this.#updatersByCpk[publicKey]
  }
}
