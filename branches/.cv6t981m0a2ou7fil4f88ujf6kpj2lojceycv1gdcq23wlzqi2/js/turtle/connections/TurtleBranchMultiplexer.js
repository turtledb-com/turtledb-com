import { logError } from '../../utils/logger.js'
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
    this.appendGeneratedIncomingForever() // don't await
  }

  stop () {
    this.#stopped = true
  }

  async appendGeneratedIncomingForever () {
    try {
      for await (const u8aTurtle of this.incomingBranch.u8aTurtleGenerator()) {
        const incoming = u8aTurtle.lookup()
        if (!incoming) continue
        const { address, /* name, */ publicKey } = incoming
        if (!(address || publicKey)) {
          throw new Error('address or publicKey required')
        }
        const uint8Array = u8aTurtle.lookup(address)
        const turtleBranchUpdater = await this.getTurtleBranchUpdater(this.name, publicKey)
        turtleBranchUpdater.incomingBranch.append(uint8Array)
        // const uint8ArrayAddresses = turtleBranchUpdater.incomingBranch.lookup('uint8ArrayAddresses')
      }
    } catch (error) {
      logError(() => console.error(error))
      throw error
    }
  }

  /**
   * @param {Uint8Array} uint8Array
   * @param {string} name
   * @param {string} publicKey
   * @param {TurtleBranchUpdater} turtleBranchUpdater
   */
  #sendMuxedUpdate (uint8Array, name, publicKey, turtleBranchUpdater) {
    const address = this.outgoingDictionary.upsert(uint8Array, [OPAQUE_UINT8ARRAY])
    const update = { address, name, publicKey }
    this.outgoingDictionary.upsert(update)
    this.outgoingDictionary.squash(this.outgoingBranch.index + 1)
    this.outgoingBranch.u8aTurtle = this.outgoingDictionary.u8aTurtle
    // const uint8ArrayAddresses = turtleBranchUpdater.outgoingBranch.lookup('uint8ArrayAddresses')
  }

  /**
   * @param {string} name
   * @param {string} publicKey
   * @returns {TurtleBranchUpdater}
   */
  async getTurtleBranchUpdater (name = '', publicKey = '', turtleBranch) {
    if (!name && !publicKey) throw new Error('no name or publicKey')
    publicKey ||= name
    name ||= publicKey
    if (!this.#updatersByCpk[publicKey]) {
      this.#updatersByCpk[publicKey] = (async () => {
        // logTrace(() => console.log({ publicKey }))
        turtleBranch ??= await this.turtleDB.summonBoundTurtleBranch(publicKey, name)
        const updater = new TurtleBranchUpdater(name, turtleBranch, publicKey, this.Xours)
        ;(async () => {
          for await (const u8aTurtle of updater.outgoingBranch.u8aTurtleGenerator()) {
            if (this.#stopped) break
            this.#sendMuxedUpdate(u8aTurtle.uint8Array, name, publicKey, updater)
          }
        })()
        updater.start()
        return updater
      })()
    }
    return this.#updatersByCpk[publicKey]
  }

  /**
   * @type {Array.<string>}
   */
  get publicKeys () {
    return Object.keys(this.#updatersByCpk)
  }
}
