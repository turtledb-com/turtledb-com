import { toSubVersions } from '../utils.js'
import { DEREFERENCE } from './CodecType.js'

export class CodecTypeVersion {
  /**
   * @param {CodecType} codecType
   * @param {number} combinedVersion
   */
  constructor (codecType, combinedVersion) {
    this.codecType = codecType
    this.combinedVersion = combinedVersion
    this.subVersions = toSubVersions(combinedVersion, codecType.subVersionCounts)
    this.width = codecType.getWidth(this)
  }

  /**
   * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
   * @param {number} address
   * @param {import('./CodecType.js').CodecOptions} options
   */
  decode (u8aTurtle, address, options = DEREFERENCE) {
    const width = this.width
    const uint8Array = u8aTurtle.slice(address - width, address)
    const value = this.codecType.decode(uint8Array, this, u8aTurtle, options)
    return value
  }
}
