import { AS_REFS, DEREFERENCE } from './codecs/CodecType.js'
import { codec } from './codecs/codec.js'
import { TurtleBranch } from './TurtleBranch.js'
import { ValueByUint8Array } from './utils.js'

export class TurtleDictionary extends TurtleBranch {
  #valueByUint8Array = new ValueByUint8Array()
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
  }

  #cache = (uint8Array, address, codecType) => {
    if (codecType.isOpaque) return
    this.#valueByUint8Array.set(uint8Array, address)
  }

  lexicograph (start = 0, end = this.length - 1, logall = false) {
    let address = end
    let u8aTurtle = this.u8aTurtle
    while (u8aTurtle) {
      while (address > start && address > u8aTurtle.offset) {
        const footer = this.getByte(address)
        const codecVersion = codec.getCodecTypeVersion(footer)
        if (!codecVersion) {
          console.error({ address, footer })
          throw new Error('no decoder for footer')
        }
        const width = codecVersion.getWidth(u8aTurtle, address)
        const uint8Array = this.slice(address - width, address + 1)
        if (logall) {
          let string = u8aTurtle.lookup(address, AS_REFS)
          if (string instanceof Uint8Array) string = [`Uint8Array( ${string.length} )`, [...string]]
          else string = [string]
          console.log(' -', address, ':', ...string)
        } else if (this.#valueByUint8Array.get(uint8Array) !== undefined) {
          console.error({ address, footer, uint8Array, width })
          throw new Error('uint8Array already stored')
        }
        this.#cache(uint8Array, address, codecVersion.codecType)
        address -= width + 1
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
    const { uint8Array, codecType } = codec.encodeValue(value, codecsArray, this, options)
    let address = this.#valueByUint8Array.get(uint8Array)
    if (address === undefined) {
      super.append(uint8Array)
      address = this.length - 1
      this.#cache(uint8Array, address, codecType)
    }
    return address
  }
}
