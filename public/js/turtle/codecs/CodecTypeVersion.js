import { toSubVersions } from '../utils.js'
import { DEREFERENCE } from './CodecType.js'

export class CodecTypeVersion {
  /**
   * @param {import('./CodecType.js').CodecType} codecType
   * @param {number} combinedVersion
   */
  constructor (codecType, combinedVersion) {
    /** @type {import('./CodecType.js').CodecType} */
    this.codecType = codecType
    this.combinedVersion = combinedVersion
    this.subVersions = toSubVersions(combinedVersion, codecType.subVersionCounts)
  }

  /**
   *
   * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
   * @param {number} address
   * @returns {number}
   */
  getWidth (u8aTurtle, address) {
    return this.codecType.getWidth(this, u8aTurtle, address)
  }

  /**
   * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
   * @param {number} address
   * @param {import('./CodecType.js').CodecOptions} options
   */
  decode (u8aTurtle, address, options = DEREFERENCE) {
    const width = this.getWidth(u8aTurtle, address)
    const uint8Array = u8aTurtle.slice(address - width, address)
    const value = this.codecType.decode(uint8Array, this, u8aTurtle, options)
    return value
  }
}
