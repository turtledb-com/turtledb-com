import { AS_REFS, DEREFERENCE } from './codecs/CodecType.js'
import { ATOMIC_UINT8ARRAY, codec } from './codecs/codec.js'
import { TurtleBranch } from './TurtleBranch.js'
import { ValueByUint8Array } from './utils.js'
import { findCommonAncestor } from './U8aTurtle.js'
import { logError, logInfo } from '../utils/logger.js'
import { JSON_FILE, pathToType, TEXT_FILE } from '../utils/fileTransformer.js'

export const OURS = 'ours'
export const THEIRS = 'theirs'
export const THROW = 'throw'

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

  #cache = (uint8Array, address) => {
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
        const uint8Array = codec.extractEncodedValue(u8aTurtle, address)
        if (!uint8Array.length) throw new Error('empty uint8Array')
        if (logall) {
          let string = u8aTurtle.lookup(address, AS_REFS)
          if (string instanceof Uint8Array) string = [`Uint8Array( ${string.length} )`, [...string]]
          else string = [string]
          logInfo(() => console.log(' -', address, ':', ...string))
        } else if (this.#valueByUint8Array?.get?.(uint8Array) !== undefined) {
          logError(() => console.error({ name: this.name, address, footer: u8aTurtle.getByte(address), uint8Array, value: u8aTurtle.lookup(address) }))
          throw new Error('uint8Array already stored')
        }
        this.#cache(uint8Array, address)
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

  /**
   * @param {U8aTurtle} theirs
   * @param {OURS | THEIRS | THROW} Xours
   * @returns {TurtleDictionary}
   */
  merge (theirs, strategy = THROW, theirStartingAddress, ...path) {
    const _merge = (commonAddress, ourAddress, theirAddress) => {
      if (theirAddress === ourAddress) return theirAddress
      if (commonAddress === ourAddress) return theirAddress
      if (commonAddress === theirAddress) return ourAddress
      const commonState = commonAddress && commonAncestor.lookup(commonAddress, AS_REFS)
      const oursState = ourAddress && this.lookup(ourAddress, AS_REFS)
      const theirsState = theirAddress && this.lookup(theirAddress, AS_REFS)
      console.log({ commonState, oursState, theirsState })
      const strategyAddress = () => {
        if (strategy === OURS) return ourAddress
        if (strategy === THEIRS) return theirAddress
        throw new Error('merge conflict, please resolve manually')
      }
      if (!commonState || !oursState || !theirsState) return strategyAddress()
      if (typeof oursState !== 'object' || typeof theirsState !== 'object') return strategyAddress()
      if (Array.isArray(oursState)) {
        if (!Array.isArray(theirsState)) return strategyAddress()
      } else {
        if (Array.isArray(theirsState)) return strategyAddress()
        if (oursState.constructor !== Object || theirsState.constructor !== Object) return strategyAddress()
      }
      const mergedState = Array.isArray(oursState) ? [] : {}
      const keys = new Set([...Object.keys(oursState), ...Object.keys(theirsState)])
      for (const key of keys) {
        const mergedKeyAddress = _merge(commonState?.[key], oursState[key], theirsState[key])
        if (mergedKeyAddress >= 0) mergedState[key] = mergedKeyAddress
      }
      const mergedAddress = this.upsert(mergedState, undefined, AS_REFS)
      return mergedAddress
    }
    const commonAncestor = findCommonAncestor(this.u8aTurtle, theirs)
    const commonAddress = commonAncestor?.getAddressAtPath?.(undefined, ...path)
    const ourAddress = this.u8aTurtle.getAddressAtPath(undefined, ...path)
    const theirAddress = this.upsert(theirs.lookup(theirStartingAddress, ...path))
    return _merge(commonAddress, ourAddress, theirAddress)
  }

  upsertFile (filename, content, valueAddress) {
    const type = pathToType(filename)
    let documentValueRefs
    if (valueAddress >= 0) {
      documentValueRefs = this.lookup(valueAddress, AS_REFS) || {}
    } else {
      documentValueRefs = this.committedBranch.lookup('document', 'value', AS_REFS) || {}
    }
    if (!content) {
      delete documentValueRefs[filename]
    } else {
      let address
      if (content instanceof Uint8Array) address = this.upsert(content, [ATOMIC_UINT8ARRAY])
      else if (typeof content === 'string') {
        if (content.length && type === JSON_FILE) address = this.upsert(JSON.parse(content))
        else if (content.length && type === TEXT_FILE) address = this.upsert(content.split('\n'))
        else address = this.upsert(content)
      } else if (content && typeof content === 'object') address = this.upsert(content)
      else throw new Error('unsupported file type')
      documentValueRefs[filename] = address
    }
    return this.upsert(documentValueRefs, undefined, AS_REFS)
  }
}
