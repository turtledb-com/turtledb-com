import { OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { TurtleBranchUpdater } from './TurtleBranchUpdater.js'
import { TurtleDB } from './TurtleDB.js'
import { TurtleTalker } from './TurtleTalker.js'
import { b36ToUint8Array } from '../utils.js'

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
    // turtleDB.getPublicKeys().forEach(publicKey => {
    //   turtleDB.getStatus(publicKey).turtleBranchPromise.then(turtleBranch => {
    //     this.getTurtleBranchUpdater(turtleBranch.name, publicKey, turtleBranch)
    //   })
    // })
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
        _logUpdate(this.name, publicKey, turtleBranchUpdater, true)
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
    _logUpdate(this.name, publicKey, turtleBranchUpdater, false)
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
        // turtleBranch ??= this.turtleDB.getStatus(publicKey, name).turtleBranch
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
function _logUpdate (name, publicKey, tbUpdater, isIncoming) {
  const separator = isIncoming ? '\x1b[35m <- \x1b[m' : '\x1b[36m -> \x1b[m'
  // const tbMuxBranch = isIncoming ? tbMux.incomingBranch : tbMux.outgoingBranch
  const tbUpdaterBranch = isIncoming ? tbUpdater.incomingBranch : tbUpdater.outgoingBranch
  const type = isIncoming ? '\x1b[35m(incoming)\x1b[m' : '\x1b[36m(outgoing)\x1b[m'
  // let publicKey = tbMuxBranch.lookup('publicKey')
  const [r0, g0, b0, r1, g1, b1] = b36ToUint8Array(publicKey).slice(-6).map(v => Math.round(255 - v * v / 255).toString())
  const bg = [40, 41, 42, 43, 44, 45, 46, 47, 100, 101, 102, 103, 104, 105, 106, 107][b36ToUint8Array(publicKey)[0] % 16]
  const colorBlock = `\x1b[48;2;${r0};${g0};${b0};38;2;${r1};${g1};${b1}m▌••🐢••▐\x1b[m`
  let prettyAddresses = []
  publicKey = `<${publicKey.slice(0, 4)}...${publicKey.slice(-4)}>`
  const uint8ArrayAddresses = tbUpdaterBranch.lookup('uint8ArrayAddresses')
  const leftmost = uint8ArrayAddresses.findIndex(x => x !== undefined)
  if (leftmost === -1) {
    prettyAddresses.push(`\x1b[2mempty × ${uint8ArrayAddresses.length}]\x1b[m`)
  } else {
    if (leftmost > 0) {
      prettyAddresses.push(`\x1b[2mempty × ${leftmost}\x1b[m`)
    }
    if (uint8ArrayAddresses.length > leftmost + 4) {
      prettyAddresses.push(uint8ArrayAddresses[leftmost])
      prettyAddresses.push(`\x1b[2mfilled × ${uint8ArrayAddresses.length - leftmost - 2}\x1b[m`)
      prettyAddresses.push(uint8ArrayAddresses[uint8ArrayAddresses.length - 1])
    } else {
      for (let i = leftmost; i < uint8ArrayAddresses.length; ++i) {
        prettyAddresses.push(uint8ArrayAddresses[i])
      }
    }
  }
  prettyAddresses = `(${uint8ArrayAddresses.length}) [${prettyAddresses.join(', ')}]`
  console.log(`${colorBlock} ${[publicKey, type, JSON.stringify(name), prettyAddresses].join(separator)}`)
}
