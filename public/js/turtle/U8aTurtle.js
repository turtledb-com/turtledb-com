import { codecVersionByFooter } from './codecs.js'
import { combineUint8Arrays, zabacaba } from './utils.js'

export class U8aTurtle {
  /** @type {Array.<U8aTurtle>} */
  seekLayers = []

  /**
   * @param {Uint8Array} uint8Array
   * @param {U8aTurtle} [parent]
   */
  constructor (uint8Array, parent) {
    if (!uint8Array) throw new Error('missing Uint8Array')
    this.uint8Array = uint8Array
    if (parent) {
      this.parent = parent
      this.offset = parent.length
      this.height = parent.height + 1
      this.length = parent.length + uint8Array.length
      let seekLayer = parent
      const seekCount = zabacaba(this.height)
      for (let i = 0; i < seekCount; ++i) {
        this.seekLayers.unshift(seekLayer)
        seekLayer = seekLayer.seekLayers[0]
      }
    } else {
      this.offset = 0
      this.height = 0
      this.length = uint8Array.length
    }
  }

  findParentByHeight (height, tooHigh) {
    if (height < 0) height += this.height
    if (height === this.height) return this
    if (height < this.height) {
      for (const seekLayer of this.seekLayers.filter(seekLayer => seekLayer !== tooHigh)) {
        const found = seekLayer.findParentByHeight(height, tooHigh)
        if (found) return found
        tooHigh = seekLayer
      }
    }
  }

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

  remapAddress (address, isLength = false) {
    if (address < 0) address += this.length
    if (address < this.offset) throw new Error('address out of range')
    if (isLength) {
      if (address > this.length) throw new Error('address out of range')
    } else {
      if (address >= this.length) throw new Error('address out of range')
    }
    return address - this.offset
  }

  getByte (address = this.length - 1) {
    return this.uint8Array[this.remapAddress(address)]
  }

  slice (start = this.offset, end = this.length) {
    return this.uint8Array.slice(this.remapAddress(start), this.remapAddress(end, true))
  }

  /**
   * @param  {[optional_address:number, ...path:Array.<string>, optional_options:import('./codecs.js').CodecOptions]} path
   * @returns {any}
   */
  lookup (...path) {
    let address = this.length - 1
    if (typeof path[0] === 'number') address = path.shift()
    /** @type {import('./codecs.js').CodecOptions} */
    let options
    if (/object|undefined/.test(typeof path[path.length - 1])) options = path.pop()
    let u8aTurtle = this
    while (path.length) {
      u8aTurtle = u8aTurtle.findParentByAddress(address)
      const codecVersion = codecVersionByFooter[u8aTurtle.getByte(address)]
      const ref = codecVersion.decode(u8aTurtle, address, { valuesAsRefs: true })
      if (!Object.hasOwn(ref, path[0])) return
      address = ref[path.shift()]
    }
    if (address instanceof Uint8Array) return address
    u8aTurtle = u8aTurtle.findParentByAddress(address)
    const codecVersion = codecVersionByFooter[u8aTurtle.getByte(address)]
    return codecVersion.decode(u8aTurtle, address, options)
  }
}

export function squashTurtle (u8aTurtle, downToHeight = 0) {
  if (downToHeight > u8aTurtle.height || downToHeight < 0) throw new Error('downToHeight out of range')
  const uint8Arrays = new Array(1 + u8aTurtle.height - downToHeight)
  let index = u8aTurtle
  while (index && index.height >= downToHeight) {
    uint8Arrays[index.height - downToHeight] = index.uint8Array
    index = index.parent
  }
  return new U8aTurtle(combineUint8Arrays(uint8Arrays), index)
}
