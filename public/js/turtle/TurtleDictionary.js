import { codecs, codecVersionByFooter } from './codecs/codecs.js'
import { TurtleBranch } from './TurtleBranch.js'
import { ValueByUint8Array } from './utils.js'

export class TurtleDictionary extends TurtleBranch {
  #valueByUint8Array = new ValueByUint8Array()
  constructor (name, recaller, u8aTurtle) {
    super(name, recaller, u8aTurtle)
    this.lexicograph()
  }

  append (uint8Array) {
    const start = this.length
    super.append(uint8Array)
    this.lexicograph(start)
  }

  #cache = (uint8Array, address, codec) => {
    if (codec.isOpaque) return console.log(codec)
    this.#valueByUint8Array.set(uint8Array, address)
  }

  lexicograph (start = 0, end = this.length - 1) {
    let address = end
    let u8aTurtle = this.u8aTurtle
    while (u8aTurtle) {
      while (address > start && address > u8aTurtle.offset) {
        const footer = this.getByte(address)
        const codecVersion = codecVersionByFooter[footer]
        if (!codecVersion) {
          console.error({ address, footer })
          throw new Error('no decoder for footer')
        }
        const width = codecVersion.width
        const uint8Array = this.slice(address - width, address)
        if (this.#valueByUint8Array.get(uint8Array) !== undefined) {
          console.error({ address, footer, uint8Array, width })
          throw new Error('uint8Array already stored')
        }
        this.#cache(uint8Array, address, codecVersion.codec)
        address -= width
      }
      u8aTurtle = u8aTurtle.parent
    }
  }

  /**
   *
   * @param {any} value
   * @param {Array.<import('./codecs/codecs.js').Codec} codecsArray
   * @param {import('./codecs/codecs.js').CodecOptions} options
   * @returns {number}
   */
  upsert (value, codecsArray = Object.values(codecs), options) {
    const codec = codecsArray.find(codec => codec.test(value)) // first match wins
    if (!codec) {
      console.error('no match', value)
      throw new Error('no encoder for value')
    }
    const uint8Array = codec.encode(value, codec, this, options)
    let address = this.#valueByUint8Array.get(uint8Array)
    if (address === undefined) {
      super.append(uint8Array)
      address = this.length - 1
      this.#cache(uint8Array, address, codec)
    }
    return address
  }
}
