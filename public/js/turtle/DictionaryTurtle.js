import { codecs, codecVersionByFooter } from './codecs.js'
import { U8aTurtleBranch } from './U8aTurtleBranch.js'
import { ValueByUint8Array } from './utils.js'

export class DictionaryTurtle extends U8aTurtleBranch {
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

  lexicograph (start = 0, end = this.length - 1) {
    let address = end
    let u8aTurtle = this.u8aTurtle
    while (u8aTurtle) {
      while (address > start && address > u8aTurtle.offset) {
        const footer = this.getByte(address)
        if (!codecVersionByFooter[footer]) {
          console.error({ address, footer })
          throw new Error('no decoder for footer')
        }
        const width = codecVersionByFooter[footer].width
        const uint8Array = this.slice(address - width, address)
        if (this.#valueByUint8Array.get(uint8Array) !== undefined) {
          console.error({ address, footer, uint8Array, width })
          throw new Error('uint8Array already stored')
        }
        this.#valueByUint8Array.set(uint8Array, address)
        address -= width
      }
      u8aTurtle = u8aTurtle.parent
    }
  }

  upsert (value, codecsArray = Object.values(codecs)) {
    const codec = codecsArray.find(codec => codec.test(value)) // first match wins
    if (!codec) {
      console.error('no match', value)
      throw new Error('no encoder for value')
    }
    const uint8Array = codec.encode(value, codec, this)
    let address = this.#valueByUint8Array.get(uint8Array)
    if (address === undefined) {
      super.append(uint8Array)
      address = this.length - 1
      this.#valueByUint8Array.set(uint8Array, address)
    }
    return address
  }
}
