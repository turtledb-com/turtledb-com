import { codec } from './codecs/codec.js'
import { AS_REFS } from './codecs/CodecType.js'
import { combineUint8Arrays } from '../utils/combineUint8Arrays.js'
import { zabacaba } from '../utils/zabacaba.js'

/**
 * @typedef {import('./codecs/CodecType.js').CodecOptions} CodecOptions
 */

export class U8aTurtle {
  /** @type {Array.<U8aTurtle>} */
  seekLayers = []

  /**
   * @param {Uint8Array} uint8Array
   * @param {U8aTurtle} parent
   */
  constructor (uint8Array, parent) {
    if (!uint8Array) throw new Error('missing Uint8Array')
    this.uint8Array = uint8Array
    this.parent = parent
    if (parent) {
      this.offset = parent.length
      this.index = parent.index + 1
      this.length = parent.length + uint8Array.length
      let seekLayer = parent
      const seekCount = zabacaba(this.index)
      for (let i = 0; i < seekCount; ++i) {
        this.seekLayers.unshift(seekLayer)
        seekLayer = seekLayer.seekLayers[0]
      }
    } else {
      this.offset = 0
      this.index = 0
      this.length = uint8Array.length
    }
  }

  /**
   * @param {number} start
   * @param {number} end
   * @returns {Array.<U8aTurtle>}
   */
  getAncestors (start = 0, end = this.index) {
    if (start > this.index || start < 0) throw new Error('start out of range')
    if (end > this.index || end < 0) throw new Error('end out of range')
    const ancestors = new Array(end + 1 - start)
    let index = end
    let ancestor = this.getAncestorByIndex(index)
    while (ancestor && index >= start) {
      ancestors[index - start] = ancestor
      --index
      ancestor = ancestor.parent
    }
    return ancestors
  }

  /**
   * @param {number} index
   * @param {number} tooHigh
   * @returns {U8aTurtle}
   */
  getAncestorByIndex (index, tooHigh) {
    if (index < 0) index += this.index
    if (index === this.index) return this
    if (index < this.index) {
      for (const seekLayer of this.seekLayers.filter(seekLayer => seekLayer !== tooHigh)) {
        const found = seekLayer.getAncestorByIndex(index, tooHigh)
        if (found) return found
        tooHigh = seekLayer
      }
    }
  }

  /**
   * @param {U8aTurtle} u8aTurtle
   * @returns {boolean}
   */
  hasAncestor (u8aTurtle) {
    if (u8aTurtle === undefined) return true
    return this.getAncestorByIndex(u8aTurtle.index) === u8aTurtle
  }

  /**
   * @param {number} address
   * @param {number} tooHigh
   * @returns {U8aTurtle}
   */
  getAncestorByAddress (address, tooHigh) {
    if (address < 0) address += this.length
    if (address >= this.offset && address < this.length) return this
    if (address < this.offset) {
      for (const seekLayer of this.seekLayers.filter(seekLayer => seekLayer !== tooHigh)) {
        const found = seekLayer.getAncestorByAddress(address, tooHigh)
        if (found) return found
        tooHigh = seekLayer
      }
    }
  }

  #remapAddress (address, isLengthOkay = false) {
    if (address < 0) address += this.length
    if (address < this.offset) throw new Error(`address (${address}) out of range: < offset (${this.offset})`)
    if (address > this.length) throw new Error(`address (${address}) out of range: > length (${this.length})`)
    if (!isLengthOkay && address === this.length) throw new Error(`address (${address}) out of range: === length (${this.length})`)
    return address - this.offset
  }

  getByte (address = this.length - 1) {
    return this.uint8Array[this.#remapAddress(address)]
  }

  slice (start = this.offset, end = this.length) {
    return this.uint8Array.subarray(this.#remapAddress(start), this.#remapAddress(end, true))
  }

  getAddressAtPath (startingAddress = this.length - 1, ...path) {
    if (!path.length) return startingAddress
    const u8aTurtle = this.getAncestorByAddress(startingAddress)
    const codecVersion = codec.getCodecTypeVersion(u8aTurtle.getByte(startingAddress))
    const ref = codecVersion.decode(u8aTurtle, startingAddress, AS_REFS)
    const key = path.shift()
    if (!ref || !(key in ref)) return
    return u8aTurtle.getAddressAtPath(ref[key], ...path)
  }

  /**
   * @param  {[optional_address:number, ...path:Array.<string>, optional_options:CodecOptions]} path
   * @returns {any}
   */
  lookup (...path) {
    let startingAddress = this.length - 1
    if (typeof path[0] === 'number') startingAddress = path.shift()
    else if (typeof path[0] === 'undefined') path.shift()
    /** @type {CodecOptions} */
    let options
    if (/object|undefined/.test(typeof path[path.length - 1])) options = path.pop()
    const address = this.getAddressAtPath(startingAddress, ...path)
    if (address === undefined) return
    if (address instanceof Uint8Array) return address
    const u8aTurtle = this.getAncestorByAddress(address)
    if (!u8aTurtle) {
      console.warn('no u8aTurtle found for address', { address, path, startingAddress, length: this.length })
      return
    }
    const codecVersion = codec.getCodecTypeVersion(u8aTurtle.getByte(address))
    return codecVersion.decode(u8aTurtle, address, options)
  }

  getCodecType (address = this.length - 1) {
    const footer = this.getAncestorByAddress(address).getByte(address)
    return codec.getCodecTypeVersion(footer)?.codecType
  }

  /**
   * @param {number} start
   * @param {number} end
   * @returns {Array.<Uint8Array>}
   */
  exportUint8Arrays (start = 0, end = this.index) {
    return this.getAncestors(start, end).map(u8aTurtle => u8aTurtle.uint8Array)
  }

  clone () { return fromUint8Arrays(this.exportUint8Arrays().map(uint8Array => new Uint8Array(uint8Array))) }
}

/**
 * @param {U8aTurtle} u8aTurtle
 * @param {number} downToIndex
 * @returns {U8aTurtle}
 */
export function squashTurtle (u8aTurtle, downToIndex = 0) {
  return new U8aTurtle(
    combineUint8Arrays(u8aTurtle.exportUint8Arrays(downToIndex)),
    u8aTurtle.getAncestorByIndex(downToIndex).parent
  )
}

/**
 * @param {U8aTurtle} a
 * @param {U8aTurtle} b
 * @returns {U8aTurtle}
 */
export function findCommonAncestor (a, b) {
  if (!a || !b) return
  const minIndex = Math.min(a.index, b.index)
  a = a.getAncestorByIndex(minIndex)
  b = b.getAncestorByIndex(minIndex)
  while (a !== b) {
    a = a.parent
    b = b.parent
  }
  return a
}

/**
 * @param {Array.<Uint8Array>} uint8Arrays
 * @returns {U8aTurtle}
 */
export function fromUint8Arrays (uint8Arrays) {
  if (!uint8Arrays?.length) throw new Error('empty uint8Arrays')
  return uint8Arrays.reduce((u8aTurtle, uint8Array) => new U8aTurtle(uint8Array, u8aTurtle), undefined)
}
