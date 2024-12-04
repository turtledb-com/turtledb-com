import { zabacaba } from './utils.js'

export class U8aTurtle {
  /** @type {Array.<U8aTurtle>} */
  seekLayers = []

  /**
   * @param {Uint8Array} uint8Array
   * @param {U8aTurtle} [parent]
   */
  constructor (uint8Array = new Uint8Array(), parent) {
    this.uint8Array = uint8Array
    if (parent) {
      this.offset = parent.length
      this.length = parent.length + uint8Array.length
      this.layerIndex = parent.layerIndex + 1
      this.parent = parent
      let seekLayer = parent
      const seekCount = zabacaba(this.layerIndex)
      for (let i = 0; i < seekCount; ++i) {
        this.seekLayers.unshift(seekLayer)
        seekLayer = seekLayer.seekLayers[0]
      }
    } else {
      this.offset = 0
      this.length = uint8Array.length
      this.layerIndex = 0
    }
  }
}
