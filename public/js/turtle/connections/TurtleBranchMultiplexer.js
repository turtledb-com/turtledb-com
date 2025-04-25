import { OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { TurtleBranchUpdater } from './TurtleBranchUpdater.js'
import { TurtleDB } from './TurtleDB.js'
import { TurtleTalker } from './TurtleTalker.js'

/**
 * @typedef {import('../U8aTurtle.js').U8aTurtle} U8aTurtle
 */

export class TurtleBranchMultiplexer extends TurtleTalker {
  /** @type {Object.<string, TurtleBranchUpdater>} */
  #updatersByCpk = {}
  #stopped = false

  /**
   * @param {string} name
   * @param {boolean} Xours
   * @param {TurtleDB} [turtleDB=new TurtleDB(name)]
   * @param {Recaller} recaller
   */
  constructor (name, Xours, turtleDB = new TurtleDB(name), recaller) {
    super(name, Xours, recaller)
    this.turtleDB = turtleDB
    this.outgoingDictionary = new TurtleDictionary(`TurtleBranchMultiplexer"${name}".outgoingDictionary`, recaller)
    this.outgoingDictionary.u8aTurtleGenerator()
    this.appendGeneratedIncomingForever() // don't await
  }

  stop () {
    this.#stopped = true
  }

  async appendGeneratedIncomingForever () {
    for await (const u8aTurtle of this.incomingBranch.u8aTurtleGenerator()) {
      const { address, name, publicKey } = u8aTurtle.lookup()
      // console.log(this.name, 'receiveUpdate', name, publicKey, address)
      const uint8Array = u8aTurtle.lookup(address)
      const turtleBranchUpdater = this.getTurtleBranchUpdater(name, publicKey)
      turtleBranchUpdater.incomingBranch.append(uint8Array)
      console.log(JSON.stringify(this.name), '<- incoming <-', publicKey, '<-', name, '<-', turtleBranchUpdater.incomingBranch.lookup('uint8ArrayAddresses'))
    }
  }

  /**
   * @param {Uint8Array} uint8Array
   * @param {string} name
   * @param {string} publicKey
   * @param {TurtleBranchUpdater} turtleBranchUpdater
   */
  #sendUpdate (uint8Array, name, publicKey, turtleBranchUpdater) {
    const address = this.outgoingDictionary.upsert(uint8Array, [OPAQUE_UINT8ARRAY])
    const update = { address, name, publicKey }
    this.outgoingDictionary.upsert(update)
    this.outgoingDictionary.squash(this.outgoingBranch.index + 1)
    this.outgoingBranch.u8aTurtle = this.outgoingDictionary.u8aTurtle
    console.log(JSON.stringify(this.name), '-> outgoing ->', publicKey, '->', name, '->', turtleBranchUpdater.outgoingBranch.lookup('uint8ArrayAddresses'))
  }

  /**
   * @param {string} name
   * @param {string} publicKey
   * @returns {TurtleBranchUpdater}
   */
  getTurtleBranchUpdater (name = '', publicKey = '') {
    publicKey ||= name
    name ||= publicKey
    if (!this.#updatersByCpk[publicKey]) {
      // console.log('????? muxer adding updater', publicKey)
      // console.log('existing for', name, this.turtleDB.getTurtleBranchInfo(publicKey)?.existingTurtleBranch)
      this.turtleDB.buildTurtleBranch(publicKey, name) // don't await
      const turtleBranch = this.turtleDB.getTurtleBranchInfo(publicKey).existingTurtleBranch
      const updater = new TurtleBranchUpdater(name, turtleBranch, publicKey, this.Xours)
      const getStopped = () => this.#stopped
      ;(async () => {
        for await (const u8aTurtle of updater.outgoingBranch.u8aTurtleGenerator()) {
          if (getStopped()) break
          this.#sendUpdate(u8aTurtle.uint8Array, name, publicKey, updater)
        }
      })()
      this.#updatersByCpk[publicKey] = updater
    }
    this.#updatersByCpk[publicKey].start()
    return this.#updatersByCpk[publicKey]
  }

  get publicKeys () {
    return Object.keys(this.#updatersByCpk)
  }
}
