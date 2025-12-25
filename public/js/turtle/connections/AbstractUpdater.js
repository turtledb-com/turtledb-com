import { logDebug } from '../../utils/logger.js'
import { Recaller } from '../../utils/Recaller.js'
import { OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
import { verifyCommitU8a } from '../Signer.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { b36ToUint8Array, deepEqualUint8Arrays } from '../utils.js'
import { TurtleTalker } from './TurtleTalker.js'

export class AbstractUpdater extends TurtleTalker {
  #isUpdating = false
  #incomingUint8ArraysByAddress = {}
  #outgoingAddressesByUint8Array = new Map()
  #previousOutgoingAddressesAddress
  /**
   * @param {string} name
   * @param {string} publicKey
   * @param {boolean} [Xours=false]
   * @param {Recaller} [recaller=new Recaller(`${name}.recaller`)]
   */
  constructor (
    name,
    publicKey,
    Xours = false,
    recaller = new Recaller(`${name}.recaller`)
  ) {
    super(name, Xours, recaller)
    if (!publicKey) throw new Error('Updaters need a publicKey')
    this.publicKey = publicKey
    this.outgoingDictionary = new TurtleDictionary(`${name}.outgoingDictionary`, recaller)
  }

  start () {
    if (this._started) return
    this._started = true
    this.incomingBranch.recaller.watch(`${JSON.stringify(this.name)}.start`, () => {
      const incomingUint8ArrayAddresses = this.incomingBranch.lookup()?.uint8ArrayAddresses
      this.update(incomingUint8ArrayAddresses)
    })
  }

  async getUint8ArraysLength () { throw new Error('class extending AbstractTurtleTalker must implement getUint8ArraysLength') }
  async setUint8ArraysLength (length) { throw new Error('class extending AbstractTurtleTalker must implement getUint8ArraysLength') }
  async getUint8Array (index) { throw new Error('class extending AsyncTurtleBranchInterface must implement getUint8Array') }
  async pushUint8Array (uint8Array) { throw new Error('class extending AsyncTurtleBranchInterface must implement pushUint8Array') }
  async popUint8Array () { throw new Error('class extending AsyncTurtleBranchInterface must implement popUint8Array') }

  /**
   * @param {Array.<number>} incomingUint8ArrayAddresses
   */
  update = async (incomingUint8ArrayAddresses) => {
    if (this.#isUpdating) return this.recaller.reportKeyAccess(this, '#isUpdating', 'update', JSON.stringify(this.name)) // try again when when it's done updating
    this.#isUpdating = true
    let length = await this.getUint8ArraysLength()
    const outgoingTurtleTalk = { uint8ArrayAddresses: [], ts: new Date().getTime() }
    if (incomingUint8ArrayAddresses) { // they're ready
      // handle incoming message (if any exist)
      logUpdate(this.name, this.publicKey, incomingUint8ArrayAddresses, true)
      await Promise.all(incomingUint8ArrayAddresses.map(indexString => this.getUint8Array(+indexString)))
      for (const indexString in incomingUint8ArrayAddresses) {
        const i = +indexString
        const incomingAddress = incomingUint8ArrayAddresses[i]
        const incomingUint8Array = this.incomingBranch.lookup(incomingAddress)
        if (i < length) { // we should already have this one
          const ourUint8Array = await this.getUint8Array(i)
          if (this.#incomingUint8ArraysByAddress[incomingAddress] === undefined && deepEqualUint8Arrays(ourUint8Array, incomingUint8Array)) {
            this.#incomingUint8ArraysByAddress[incomingAddress] = ourUint8Array
          }
          if (this.#incomingUint8ArraysByAddress[incomingAddress] !== ourUint8Array) { // collision!
            if (this.Xours) {
              incomingUint8ArrayAddresses.length = i
              break
            } else {
              await this.setUint8ArraysLength(i)
              length = await this.getUint8ArraysLength()
            }
          }
        }
        if (i === length) { // we don't have this one yet
          if (this.publicKey) {
            const previousUint8Array = i && await this.getUint8Array(i - 1)
            if (this.Xours && !(await verifyCommitU8a(this.publicKey, incomingUint8Array, previousUint8Array))) {
              if (this.Xours) {
                incomingUint8ArrayAddresses.length = Math.max(i - 1, 0)
              }
              break
            }
          }
          await this.pushUint8Array(incomingUint8Array)
          length = await this.getUint8ArraysLength()
        }
      }
      const startingIndex = Math.min(incomingUint8ArrayAddresses.length, length)
      if (startingIndex > 0 && this.Xours) {
        const uint8Array = await this.getUint8Array(startingIndex - 1)
        if (this.#outgoingAddressesByUint8Array.get(uint8Array) === undefined) {
          this.#outgoingAddressesByUint8Array.set(uint8Array, this.outgoingDictionary.upsert(uint8Array, [OPAQUE_UINT8ARRAY]))
          outgoingTurtleTalk.uint8ArrayAddresses[startingIndex - 1] = this.#outgoingAddressesByUint8Array.get(uint8Array)
        }
      }
      for (let i = startingIndex; i < length; ++i) { // send them what they're missing
        const uint8Array = await this.getUint8Array(i)
        if (this.#outgoingAddressesByUint8Array.get(uint8Array) === undefined) {
          this.#outgoingAddressesByUint8Array.set(uint8Array, this.outgoingDictionary.upsert(uint8Array, [OPAQUE_UINT8ARRAY]))
        }
        outgoingTurtleTalk.uint8ArrayAddresses[i] = this.#outgoingAddressesByUint8Array.get(uint8Array)
      }
    }

    outgoingTurtleTalk.uint8ArrayAddresses.length = length
    const outgoingAddressesAddress = this.outgoingDictionary.upsert(outgoingTurtleTalk.uint8ArrayAddresses)
    if (this.#previousOutgoingAddressesAddress !== outgoingAddressesAddress) {
      this.#previousOutgoingAddressesAddress = outgoingAddressesAddress
      this.outgoingDictionary.upsert(outgoingTurtleTalk)
      this.outgoingDictionary.squash(this.outgoingBranch.index + 1)
      this.outgoingBranch.u8aTurtle = this.outgoingDictionary.u8aTurtle
      logDebug(() => console.log(this.name, this.publicKey))
      logUpdate(this.name, this.publicKey, outgoingTurtleTalk.uint8ArrayAddresses, false)
    }

    this.#isUpdating = false
    this.recaller.reportKeyMutation(this, '#isUpdating', 'update', JSON.stringify(this.name))
  }

  /**
   * @type {Promise.<void>}
   */
  get settle () {
    let resolve
    const settlePromise = new Promise((...args) => { [resolve] = args })
    const checkSettle = () => {
      const incoming = this.incomingBranch.lookup()
      logDebug(() => console.log('checkSettle', this.turtleBranch.index + 1, '>=', incoming?.uint8ArrayAddresses?.length))
      if (this.turtleBranch.index + 1 >= incoming?.uint8ArrayAddresses?.length) {
        this.incomingBranch.recaller.unwatch(checkSettle)
        resolve()
      }
    }
    this.incomingBranch.recaller.watch(`TBMux"${this.name}".settle`, checkSettle)
    return settlePromise
  }
}

/**
 * @param {string} name
 * @param {string} publicKey
 * @param {Array.<number>} uint8ArrayAddresses
 * @param {boolean} isIncoming
 */
export function logUpdate (name, publicKey, uint8ArrayAddresses, isIncoming) {
  const separator = isIncoming ? '\x1b[31m <- \x1b[0m' : '\x1b[32m -> \x1b[0m'
  const type = isIncoming ? '\x1b[31m(incoming)\x1b[0m' : '\x1b[32m(outgoing)\x1b[0m'
  // let publicKey = tbMuxBranch.lookup('publicKey')
  const [r0, g0, b0, r1, g1, b1] = b36ToUint8Array(publicKey).slice(-6).map(v => Math.round(255 - v * v / 255).toString())
  const colorBlock = `\x1b[48;2;${r0};${g0};${b0};38;2;${r1};${g1};${b1}m▛▞▖🐢 ▝▞▟\x1b[0m`
  let prettyAddresses = []
  publicKey = `<${publicKey.slice(0, 4)}...${publicKey.slice(-4)}>`
  const leftmost = uint8ArrayAddresses.findIndex(x => x !== undefined)
  if (leftmost === -1) {
    prettyAddresses.push(`\x1b[2mempty × ${uint8ArrayAddresses.length}]\x1b[0m`)
  } else {
    if (leftmost > 0) {
      prettyAddresses.push(`\x1b[2mempty × ${leftmost}\x1b[0m`)
    }
    if (uint8ArrayAddresses.length > leftmost + 4) {
      prettyAddresses.push(`\x1b[34m${uint8ArrayAddresses[leftmost]}\x1b[0m`)
      prettyAddresses.push(`\x1b[2m... (${uint8ArrayAddresses.length - leftmost - 2})\x1b[0m`)
      prettyAddresses.push(`\x1b[34m${uint8ArrayAddresses[uint8ArrayAddresses.length - 1]}\x1b[0m`)
    } else {
      for (let i = leftmost; i < uint8ArrayAddresses.length; ++i) {
        prettyAddresses.push(`\x1b[34m${uint8ArrayAddresses[i]}\x1b[0m`)
      }
    }
  }
  prettyAddresses = `(${uint8ArrayAddresses.length}) [${prettyAddresses.join(', ')}]`
  logDebug(() => console.log(`${colorBlock} ${[publicKey, type, `\x1b[31m${JSON.stringify(name)}\x1b[0m`, prettyAddresses].join(separator)}`))
}
