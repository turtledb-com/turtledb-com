import { b36ToBigInt, b36ToUint8Array, bigIntToUint8Array, uint8ArrayToB36, uint8ArrayToBigInt } from '../utils.js'

export class CompactPublicKey {
  /** @type {Uint8Array} */
  #uint8Array
  /** @type {string} */
  #string
  /** @type {bigint} */
  #bigInt
  constructor (value) {
    if (value instanceof Uint8Array) {
      this.uint8Array = value
    } else if (typeof value === 'bigint') {
      this.bigInt = value
    } else if (typeof value === 'string') {
      this.string = value
    } else {
      throw new Error('bad type for compact public key')
    }
  }

  set uint8Array (uint8Array) {
    this.#uint8Array = uint8Array
    this.#string = uint8ArrayToB36(uint8Array)
    this.#bigInt = uint8ArrayToBigInt(uint8Array)
  }

  get uint8Array () {
    return this.#uint8Array
  }

  set string (string) {
    this.#string = string
    this.#uint8Array = b36ToUint8Array(string)
    this.#bigInt = b36ToBigInt(string)
  }

  get string () {
    return this.#string
  }

  set bigInt (bigInt) {
    this.#bigInt = bigInt
    this.#uint8Array = bigIntToUint8Array(bigInt)
    this.#string = bigInt.toString(36)
  }

  get bigInt () {
    return this.#bigInt
  }
}
