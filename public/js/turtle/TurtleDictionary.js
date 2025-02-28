import { AS_REFS, DEREFERENCE } from './codecs/CodecType.js'
import { codec } from './codecs/codec.js'
import { TurtleBranch } from './TurtleBranch.js'
import { ValueByUint8Array } from './utils.js'

export class TurtleDictionary extends TurtleBranch {
  /** @type {ValueByUint8Array} */
  #valueByUint8Array
  /**
   * @param {string} name
   * @param {import('../utils/Recaller.js').Recaller} recaller
   * @param {import('./U8aTurtle.js').U8aTurtle} u8aTurtle
   */
  constructor (name, recaller, u8aTurtle) {
    super(name, recaller, u8aTurtle)
    this.lexicograph()
  }

  append (uint8Array) {
    const start = this.length
    super.append(uint8Array)
    this.lexicograph(start)
    return this.length - 1
  }

  #cache = (uint8Array, address, codecType) => {
    if (codecType.isOpaque) return
    this.#valueByUint8Array.set(uint8Array, address)
  }

  lexicograph (start = 0, end = this.length - 1, logall = false) {
    if (start === 0) {
      this.#valueByUint8Array = new ValueByUint8Array()
    }
    let address = end
    let u8aTurtle = this.u8aTurtle
    while (u8aTurtle) {
      while (address > start && address > u8aTurtle.offset) {
        const codecVersion = codec.extractCodecTypeVersion(u8aTurtle, address)
        const uint8Array = codec.extractEncodedValue(u8aTurtle, address)
        if (logall) {
          let string = u8aTurtle.lookup(address, AS_REFS)
          if (string instanceof Uint8Array) string = [`Uint8Array( ${string.length} )`, [...string]]
          else string = [string]
          console.log(' -', address, ':', ...string)
        } else if (this.#valueByUint8Array.get(uint8Array) !== undefined) {
          // console.error({ address, footer: u8aTurtle.getByte(address), uint8Array })
          throw new Error('uint8Array already stored')
        }
        this.#cache(uint8Array, address, codecVersion.codecType)
        address -= uint8Array.length
      }
      u8aTurtle = u8aTurtle.parent
    }
  }

  /**
   * @param {any} value
   * @param {Array.<import('./codecs/CodecType.js').CodecType>} codecsArray
   * @param {import('./codecs/CodecType.js').CodecOptions} options
   * @returns {number}
   */
  upsert (value, codecsArray, options = DEREFERENCE) {
    const { uint8Array } = codec.encodeValue(value, codecsArray, this, options)
    let address = this.#valueByUint8Array.get(uint8Array)
    if (address === undefined) {
      address = this.append(uint8Array)
    }
    return address
  }
}
