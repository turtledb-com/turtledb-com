import { AS_REFS, DEREFERENCE } from './codecs/CodecType.js'
import { codec } from './codecs/codec.js'
import { TurtleBranch } from './TurtleBranch.js'
import { ValueByUint8Array } from './utils.js'
import { findCommonAncestor } from './U8aTurtle.js'

/**
 * @typedef {import('./U8aTurtle.js').U8aTurtle} U8aTurtle
 * @typedef {import('../utils/Recaller.js').Recaller} Recaller
 * @typedef {import('./codecs/CodecType.js').CodecType} CodecType
 * @typedef {import('./codecs/CodecType.js').CodecOptions} CodecOptions
 */

export class TurtleDictionary extends TurtleBranch {
  /** @type {U8aTurtle} */
  #lastLexicographedTurtle
  /** @type {ValueByUint8Array} */
  #valueByUint8Array
  /**
   * @param {string} name
   * @param {Recaller} recaller
   * @param {U8aTurtle} u8aTurtle
   */
  constructor (name, recaller, u8aTurtle) {
    super(name, recaller, u8aTurtle)
    this.lexicograph()
  }

  append (uint8Array) {
    super.append(uint8Array)
    this.lexicograph()
    return this.length - 1
  }

  #cache = (uint8Array, address, codecType) => {
    if (codecType.isOpaque) return
    this.#valueByUint8Array.set(uint8Array, address)
  }

  lexicograph (logall = false) {
    if (!this.u8aTurtle) return
    const commonAncestor = findCommonAncestor(this.u8aTurtle, this.#lastLexicographedTurtle)
    if (!commonAncestor || commonAncestor !== this.#lastLexicographedTurtle) {
      this.#valueByUint8Array = new ValueByUint8Array()
      this.#lastLexicographedTurtle = undefined
    }

    let u8aTurtle = this.u8aTurtle
    let address = u8aTurtle.length - 1
    while (u8aTurtle !== this.#lastLexicographedTurtle) {
      while (address >= u8aTurtle.offset) {
        const codecVersion = codec.extractCodecTypeVersion(u8aTurtle, address)
        const uint8Array = codec.extractEncodedValue(u8aTurtle, address)
        if (!uint8Array.length) throw new Error('empty uint8Array')
        if (logall) {
          let string = u8aTurtle.lookup(address, AS_REFS)
          if (string instanceof Uint8Array) string = [`Uint8Array( ${string.length} )`, [...string]]
          else string = [string]
          console.log(' -', address, ':', ...string)
        } else if (this.#valueByUint8Array?.get?.(uint8Array) !== undefined) {
          console.error({ name: this.name, address, footer: u8aTurtle.getByte(address), uint8Array, value: u8aTurtle.lookup(address) })
          throw new Error('uint8Array already stored')
        }
        this.#cache(uint8Array, address, codecVersion.codecType)
        address -= uint8Array.length
      }
      u8aTurtle = u8aTurtle.parent
    }
    this.#lastLexicographedTurtle = this.u8aTurtle
  }

  /**
   * @param {any} value
   * @param {Array.<CodecType>} codecsArray
   * @param {CodecOptions} options
   * @returns {number}
   */
  upsert (value, codecsArray, options = DEREFERENCE) {
    const { uint8Array } = codec.encodeValue(value, codecsArray, this, options)
    let address = this.#valueByUint8Array?.get?.(uint8Array)
    if (address === undefined) {
      address = this.append(uint8Array)
    }
    return address
  }
}
