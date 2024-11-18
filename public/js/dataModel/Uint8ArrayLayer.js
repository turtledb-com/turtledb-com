import { CODEC, ALL_CODECS, Codec, KIND, getCodecs } from './CODECS.js'

export class Uint8ArrayLayer {
  /** @type {Array.<Uint8ArrayLayer>} */
  seekLayers = []

  /**
   * @param {Uint8Array} uint8Array
   * @param {Uint8ArrayLayer} [parent]
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

  lookup (address = this.length - 1, codecs = getCodecs(KIND.TOP)) {
    const footer = this.getByte(address)
    const codec = Codec.calculateCodec(footer, codecs)
    return codec.decodeValue(this, address, footer)
  }

  /**
   * @param {number} layerIndex
   * @param {Uint8ArrayLayer} tooHighLayer
   * @returns {Uint8ArrayLayer}
   */
  getLayerAtIndex (layerIndex, tooHighLayer) {
    if (layerIndex === this.layerIndex) {
      return this
    }
    if (layerIndex < this.layerIndex) {
      for (const seekLayer of this.seekLayers) {
        if (seekLayer === tooHighLayer) continue
        const found = seekLayer.getLayerAtIndex(layerIndex, tooHighLayer)
        if (found) return found
        tooHighLayer = seekLayer
      }
    }
  }

  /**
   * @param {number} address
   * @param {Uint8ArrayLayer} tooHighLayer
   * @returns {Uint8ArrayLayer}
   */
  getLayerContainingAddress (address, tooHighLayer) {
    if (address >= this.offset && address < this.length) {
      return this
    }
    if (address < this.offset) {
      for (const seekLayer of this.seekLayers) {
        if (seekLayer !== tooHighLayer) {
          const found = seekLayer.getLayerContainingAddress(address, tooHighLayer)
          if (found) return found
          tooHighLayer = seekLayer
        }
      }
    }
  }

  /**
   * @param {number} address
   * @returns {number}
   */
  getByte (address) {
    const storage = this.getLayerContainingAddress(address)
    if (!storage) return
    return storage.uint8Array[address - storage.offset]
  }

  /**
   * @param {number} [layerIndex=0]
   * @returns {Uint8ArrayLayer}
   */
  collapseTo (layerIndex = 0) {
    let tempLayer = this
    const uint8Arrays = []
    while (tempLayer?.layerIndex >= layerIndex) {
      uint8Arrays.unshift(tempLayer.uint8Array)
      tempLayer = tempLayer.seekLayers[tempLayer.seekLayers.length - 1]
    }
    const collapsedUint8Array = collapseUint8Arrays(...uint8Arrays)
    return new Uint8ArrayLayer(collapsedUint8Array, tempLayer)
  }

  /**
   * @param {number} start
   * @param {number} end
   * @returns {Uint8Array}
   */
  slice (start, end) {
    const storage = this.getLayerContainingAddress(start)
    if (!storage) return
    if (end === undefined) end = storage.length
    if (end > storage.length) {
      console.log(this)
      console.log({ start, end, storageLength: storage.length })
      throw new Error('slice can not span layers (should it?)')
    }
    return storage.uint8Array.slice(start - storage.offset, end - storage.offset)
  }

  getAddress (...path) {
    let address = this.length - 1
    if (path[0] === undefined) path.shift()
    if (typeof path[0] === 'number') address = path.shift()
    if (address < 0) return undefined
    const footer = this.getByte(address)
    const codec = Codec.calculateCodec(footer, ALL_CODECS)
    // console.log(codec)
    if (codec === CODEC.OPAQUE) {
      const { blocks } = codec.decodeBlocksAndNextAddress(this, address, footer)
      address -= (1 + blocks.length + 64)
    }
    while (path.length) {
      const refs = this.lookup(address, getCodecs(KIND.REFS_TOP))
      // if (typeof refs === 'number') console.log(this.lookup(refs))
      // console.log({ refs })
      const name = path.shift()
      if (!Object.hasOwn(refs, name)) throw new Error(`no "${name}" in ${refs}, ${address}`)
      address = refs?.[name]
    }
    return address
  }

  getValue (...path) {
    let codecs
    if (Array.isArray(path[path.length - 1])) codecs = path.pop()
    const address = this.getAddress(...path)
    if (!address) return undefined
    return this.lookup(address, codecs)
  }

  getRefs (...path) {
    return this.getValue(...path, getCodecs(KIND.REFS_TOP))
  }
}

/**
 * @param {...Uint8Array} uint8Arrays
 * @returns {Uint8Array}
 */
export function collapseUint8Arrays (...uint8Arrays) {
  uint8Arrays = uint8Arrays.map(uint8Array => {
    if (uint8Array instanceof Uint8Array) return uint8Array
    if (uint8Array instanceof Object.getPrototypeOf(Uint8Array)) return new Uint8Array(uint8Array.buffer)
    if (Number.isInteger(uint8Array) && uint8Array <= 0xff) return new Uint8Array([uint8Array])
    console.error(uint8Arrays)
    throw new Error('can\'t convert to Uint8Array')
  })
  const combinedLength = uint8Arrays.reduce((l, u8a) => l + (u8a?.length ?? 0), 0)
  const collapsedUint8Array = new Uint8Array(combinedLength)
  let address = 0
  for (const uint8Array of uint8Arrays) {
    if (uint8Array?.length) {
      collapsedUint8Array.set(uint8Array, address)
      address += uint8Array.length
    }
  }
  return collapsedUint8Array
}

/**
 *                                                                 |                                                               |
 *                                 |                               |                               |                               |
 *                 |               |               |               |               |               |               |               |
 *         |       |       |       |       |       |       |       |       |       |       |       |       |       |       |       |
 *     |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |
 *   | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | |
 *  ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
 * zabacabadabacabaeabacabadabacabafabacabadabacabaeabacabadabacabagabacabadabacabaeabacabadabacabafabacabadabacabaeabacabadabacaba
 * like the "ruler function" (abacaba) but with numbers for binary-tree-like jumping
 */
function zabacaba (i) {
  if (i === 1) return 1
  --i
  const b = Math.clz32(~i & -~i) // 31 - b is right zeros
  return 32 - b
}

/*
let name = ''
const rows = [[], [], [], [], [], [], []]
for (let i = 0; i <= 128; ++i) {
  const a = zabacaba(i)
  name = `${name}${'zabcdefg'.charAt(a)}`
  for (let j = 0; j < rows.length; ++j) {
    rows[j].push(j < a ? '|' : ' ')
  }
}
console.log('/**')
for (let j = rows.length - 1; j >= 0; --j) {
  console.log(` * ${rows[j].join('')}`)
}
console.log(` * ${name}`)
console.log(' *\/')
*/
