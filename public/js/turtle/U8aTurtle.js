import { codec } from './codecs/codec.js'
import { AS_REFS } from './codecs/CodecType.js'
import { combineUint8Arrays, zabacaba } from './utils.js'

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
   * @param {number} index
   * @param {number} tooHigh
   * @returns {U8aTurtle}
   */
  findParentByIndex (index, tooHigh) {
    if (index < 0) index += this.index
    if (index === this.index) return this
    if (index < this.index) {
      for (const seekLayer of this.seekLayers.filter(seekLayer => seekLayer !== tooHigh)) {
        const found = seekLayer.findParentByIndex(index, tooHigh)
        if (found) return found
        tooHigh = seekLayer
      }
    }
  }

  /**
   * @param {number} address
   * @param {number} tooHigh
   * @returns {U8aTurtle}
   */
  findParentByAddress (address, tooHigh) {
    if (address < 0) address += this.length
    if (address >= this.offset && address < this.length) return this
    if (address < this.offset) {
      for (const seekLayer of this.seekLayers.filter(seekLayer => seekLayer !== tooHigh)) {
        const found = seekLayer.findParentByAddress(address, tooHigh)
        if (found) return found
        tooHigh = seekLayer
      }
    }
  }

  #remapAddress (address, isLengthOkay = false) {
    if (address < 0) address += this.length
    if (address < this.offset) throw new Error('address out of range')
    if (address > this.length) throw new Error('address out of range')
    if (!isLengthOkay && address === this.length) throw new Error('address out of range')
    return address - this.offset
  }

  getByte (address = this.length - 1) {
    return this.uint8Array[this.#remapAddress(address)]
  }

  slice (start = this.offset, end = this.length) {
    return this.uint8Array.slice(this.#remapAddress(start), this.#remapAddress(end, true))
  }

  /**
   * @param  {[optional_address:number, ...path:Array.<string>, optional_options:import('./codecs/CodecType.js').CodecOptions]} path
   * @returns {any}
   */
  lookup (...path) {
    let address = this.length - 1
    if (typeof path[0] === 'number') address = path.shift()
    /** @type {import('./codecs/CodecType.js').CodecOptions} */
    let options
    if (/object|undefined/.test(typeof path[path.length - 1])) options = path.pop()
    let u8aTurtle = this
    while (path.length) {
      u8aTurtle = u8aTurtle.findParentByAddress(address)
      const codecVersion = codec.getCodecTypeVersion(u8aTurtle.getByte(address))
      const ref = codecVersion.decode(u8aTurtle, address, AS_REFS)
      if (!Object.hasOwn(ref, path[0])) return
      address = ref[path.shift()]
    }
    if (address instanceof Uint8Array) return address
    u8aTurtle = u8aTurtle.findParentByAddress(address)
    const codecVersion = codec.getCodecTypeVersion(u8aTurtle.getByte(address))
    return codecVersion.decode(u8aTurtle, address, options)
  }

  getCodecType (address = this.length - 1) {
    const footer = this.findParentByAddress(address).getByte(address)
    return codec.getCodecTypeVersion(footer)?.codecType
  }

  /**
   * @param {number} start
   * @param {number} end
   * @returns {Array.<Uint8Array>}
   */
  exportUint8Arrays (start = 0, end = this.index) {
    if (start > this.index || start < 0) throw new Error('start out of range')
    if (end > this.index || end < 0) throw new Error('end out of range')
    const uint8Arrays = new Array(1 + end - start)
    let index = this.findParentByIndex(end)
    while (index && index.index >= start) {
      uint8Arrays[index.index - start] = index.uint8Array
      index = index.parent
    }
    return uint8Arrays
  }
}

/**
 * @param {U8aTurtle} u8aTurtle
 * @param {number} downToIndex
 * @returns {U8aTurtle}
 */
export function squashTurtle (u8aTurtle, downToIndex = 0) {
  return new U8aTurtle(
    combineUint8Arrays(u8aTurtle.exportUint8Arrays(downToIndex)),
    u8aTurtle.findParentByIndex(downToIndex).parent
  )
}
