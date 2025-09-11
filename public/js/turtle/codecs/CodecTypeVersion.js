import { toSubVersions } from '../../utils/toSubVersions.js'
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
    this.versionArrays = toSubVersions(combinedVersion, codecType.versionArrayCounts)
  }

  /**
   *
   * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
   * @param {number} [address=u8aTurtle.length - 1]
   * @returns {number}
   */
  getWidth (u8aTurtle, address = u8aTurtle.length - 1) {
    return this.codecType.getWidth(this, u8aTurtle, address)
  }

  /**
   * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
   * @param {number} [address=u8aTurtle.length - 1]
   * @param {import('./CodecType.js').CodecOptions} [options=DEREFERENCE]
   */
  decode (u8aTurtle, address = u8aTurtle.length - 1, options = DEREFERENCE) {
    const width = this.getWidth(u8aTurtle, address)
    const uint8Array = u8aTurtle.slice(address - width, address)
    const value = this.codecType.decode(uint8Array, this, u8aTurtle, options)
    return value
  }
}
