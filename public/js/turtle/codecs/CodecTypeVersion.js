import { toSubVersions } from '../utils.js'
import { DEREFERENCE } from './CodecType.js'

export class CodecTypeVersion {
  /**
   * @param {CodecType} codec
   * @param {number} combinedVersion
   */
  constructor (codec, combinedVersion) {
    this.codec = codec
    this.combinedVersion = combinedVersion
    this.subVersions = toSubVersions(combinedVersion, codec.subVersionCounts)
    this.width = codec.getWidth(this)
  }

  /**
   * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
   * @param {number} address
   * @param {import('./CodecType.js').CodecOptions} options
   */
  decode (u8aTurtle, address, options = DEREFERENCE) {
    const width = this.width
    const uint8Array = u8aTurtle.slice(address - width, address)
    const value = this.codec.decode(uint8Array, this, u8aTurtle, options)
    return value
  }
}
