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
    try {
      for await (const u8aTurtle of this.incomingBranch.u8aTurtleGenerator()) {
        const { address, name, publicKey } = u8aTurtle.lookup()
        if (!(address || publicKey)) {
          throw new Error('address or publicKey required')
        }
        const uint8Array = u8aTurtle.lookup(address)
        const turtleBranchUpdater = await this.getTurtleBranchUpdater(name, publicKey)
        turtleBranchUpdater.incomingBranch.append(uint8Array)
        _logUpdate(this, turtleBranchUpdater, true)
      }
    } catch (error) {
      console.error(error)
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
    _logUpdate(this, turtleBranchUpdater, false)
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
        // console.log({ publicKey })
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

/**
 *
 * @param {TurtleBranchMultiplexer} tbMux
 * @param {TurtleBranchUpdater} tbUpdater
 * @param {boolean} isIncoming
 */
function _logUpdate (tbMux, tbUpdater, isIncoming) {
  const separator = isIncoming ? ' <- ' : ' -> '
  const tbMuxBranch = isIncoming ? tbMux.incomingBranch : tbMux.outgoingBranch
  const tbUpdaterBranch = isIncoming ? tbUpdater.incomingBranch : tbUpdater.outgoingBranch
  const type = isIncoming ? '(incoming)' : '(outgoing)'
  let publicKey = tbMuxBranch.lookup('publicKey')
  publicKey = `<${publicKey.slice(0, 4)}...${publicKey.slice(-4)}>`
  const uint8ArrayAddresses = tbUpdaterBranch.lookup('uint8ArrayAddresses')
  let prettyAddresses = []
  let i = 0
  for (const key of Object.keys(uint8ArrayAddresses)) {
    if (+key - i) prettyAddresses.push(`empty × ${+key - i}`)
    prettyAddresses.push(uint8ArrayAddresses[key])
    i = +key + 1
  }
  if (uint8ArrayAddresses.length - i) prettyAddresses.push(`empty × ${uint8ArrayAddresses.length - i}`)
  prettyAddresses = `(${uint8ArrayAddresses.length}) [${prettyAddresses.join(', ')}]`
  console.log(`${[publicKey, type, JSON.stringify(tbMux.name), prettyAddresses].join(separator)}`)
}
