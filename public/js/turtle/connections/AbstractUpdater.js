import { Recaller } from '../../utils/Recaller.js'
import { OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
import { verifyCommitU8a } from '../Signer.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { deepEqualUint8Arrays } from '../utils.js'
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
            if (!(await verifyCommitU8a(this.publicKey, incomingUint8Array, previousUint8Array))) {
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
    }

    this.#isUpdating = false
    this.recaller.reportKeyMutation(this, '#isUpdating', 'update', JSON.stringify(this.name))
  }
}
