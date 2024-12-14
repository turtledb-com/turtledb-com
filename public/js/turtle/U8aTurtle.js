import { zabacaba } from './utils.js'

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

  findParentByAddress (address, tooHigh) {
    if (address >= this.offset && address < this.length) return this
    if (address < this.offset) {
      for (const seekLayer of this.seekLayers.filter(seekLayer => seekLayer !== tooHigh)) {
        const found = seekLayer.findParentByAddress(address, tooHigh)
        if (found) return found
        tooHigh = seekLayer
      }
    }
  }
}
