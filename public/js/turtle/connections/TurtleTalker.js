import { Recaller } from '../../utils/Recaller.js'
import { OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
import { verifyTurtleCommit } from '../Signer.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { findCommonAncestor, U8aTurtle } from '../U8aTurtle.js'
import { deepEqualUint8Arrays } from '../utils.js'

/**
 * @typedef {{ts: Date, uint8ArrayAddresses: Array.<number>}} TurtleTalk
 */

export class AbstractTurtleTalker {
  #isUpdating = false
  #incomingUint8ArraysByAddress = {}
  #outgoingAddressesByUint8Array = new Map()
  #previousOutgoingAddressesAddress
  /**
   * @param {string} name
   * @param {string} publicKey
   * @param {boolean} [isTrusted=false]
   * @param {Recaller} [recaller=new Recaller(`${name}.recaller`)]
   */
  constructor (
    name,
    publicKey,
    isTrusted = false,
    recaller = new Recaller(`${name}.recaller`)
  ) {
    this.name = name
    this.publicKey = publicKey
    this.isTrusted = isTrusted
    this.recaller = recaller
    this.outgoingDictionary = new TurtleDictionary(`${name}.outgoingDictionary`, recaller)
    this.outgoingBranch = new TurtleBranch(`${name}.outgoingBranch`, recaller)
    this.incomingBranch = new TurtleBranch(`${name}.incomingBranch`, recaller)
  }

  start () {
    this.recaller.watch(`${JSON.stringify(this.name)}.start`, () => {
      const incomingUint8ArrayAddresses = this.incomingBranch.lookup()?.uint8ArrayAddresses // trigger key access reporter
      this.update(incomingUint8ArrayAddresses)
    })
  }

  /** @param {TurtleBranch} connection */
  connect (connection) {
    this.makeReadableStream().pipeTo(connection.makeWritableStream())
    connection.makeReadableStream().pipeTo(this.makeWritableStream())
  }

  makeReadableStream () { return this.outgoingBranch.makeReadableStream() }
  makeWritableStream () { return this.incomingBranch.makeWritableStream() }

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
    // console.log(`${JSON.stringify(this.name)} receiving uint8ArrayAddresses`, incomingUint8ArrayAddresses)
    let length = await this.getUint8ArraysLength()
    const outgoingTurtleTalk = { uint8ArrayAddresses: [], ts: new Date().getTime() }
    if (incomingUint8ArrayAddresses) { // they're ready
      // handle incoming message (if any exist)
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
            if (this.isTrusted) {
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
            const nextTurtle = new U8aTurtle(
              incomingUint8Array,
              i && new U8aTurtle(await this.getUint8Array(i - 1))
            )
            if (!(await verifyTurtleCommit(nextTurtle, this.publicKey))) {
              if (this.isTrusted) {
                incomingUint8ArrayAddresses.length = Math.max(i - 1, 0)
              }
              break
            }
          }
          await this.pushUint8Array(incomingUint8Array)
          length = await this.getUint8ArraysLength()
        }
      }
      const startingIndex = incomingUint8ArrayAddresses.length
      if (startingIndex > 0 && this.isTrusted) {
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
    }

    this.#isUpdating = false
    this.recaller.reportKeyMutation(this, '#isUpdating', 'update', JSON.stringify(this.name))
  }
}

export class TurtleBranchTurtleTalker extends AbstractTurtleTalker {
  /**
   * @param {string} name
   * @param {TurtleBranch} turtleBranch
   * @param {string} publicKey
   * @param {boolean} [isTrusted=false]
   * @param {Recaller} [recaller=new Recaller(`${name}.recaller`)]
   */
  constructor (name, turtleBranch, publicKey, isTrusted, recaller = new Recaller(name)) {
    super(name, publicKey, isTrusted, recaller)
    this.turtleBranch = turtleBranch
    /** @type {U8aTurtle} */
    let lastU8aTurtle
    this.turtleBranch.recaller.watch(name, () => {
      if (this.turtleBranch.u8aTurtle !== lastU8aTurtle) {
        const incomingUint8ArrayAddresses = this.incomingBranch.lookup()?.uint8ArrayAddresses
        if (incomingUint8ArrayAddresses?.length && !this.turtleBranch.u8aTurtle.hasAncestor(lastU8aTurtle)) {
          const commonAncestor = findCommonAncestor(lastU8aTurtle, this.turtleBranch.u8aTurtle)
          if (commonAncestor) {
            incomingUint8ArrayAddresses.length = Math.min(incomingUint8ArrayAddresses.length, commonAncestor.index + 1)
          } else {
            incomingUint8ArrayAddresses.length = 0
          }
        }
        this.update(incomingUint8ArrayAddresses)
        lastU8aTurtle = this.turtleBranch.u8aTurtle
      }
    })
  }

  async getUint8ArraysLength () { return this.turtleBranch.index + 1 }
  async setUint8ArraysLength (length) { this.turtleBranch.u8aTurtle = length ? this.turtleBranch.u8aTurtle?.getAncestorByIndex?.(length - 1) : undefined }
  async getUint8Array (index) { return this.turtleBranch.u8aTurtle?.getAncestorByIndex?.(index)?.uint8Array }
  async pushUint8Array (uint8Array) { return this.turtleBranch.append(uint8Array) }

  async popUint8Array () { this.turtleBranch.u8aTurtle = this.turtleBranch.u8aTurtle.parent }
}
