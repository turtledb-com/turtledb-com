import { logError } from '../../utils/logger.js'
import { toCombinedVersion } from '../../utils/toCombinedVersion.js'
import { toVersionCount } from '../../utils/toVersionCount.js'
import { DEREFERENCE } from './CodecType.js'
import { CodecTypeVersion } from './CodecTypeVersion.js'

/**
 * @typedef {import('./CodecType.js').CodecType} CodecType
 * @typedef {import('../U8aTurtle.js').U8aTurtle} U8aTurtle
 */

export class CompositeCodec {
  /** @type {Array.<CodecType>} */
  codecTypes = []
  /** @type {Object.<string, CodecType>} */
  codecTypesByName = {}
  /** @type {Array.<CodecTypeVersion>} */
  codecTypeVersionsByFooter = []
  /** @type {Map.<CodecType, Array} */
  footerByCodecTypeAndCombinedVersions = new Map()

  encodeValue (value, codecsArray = this.codecTypes, dictionary, options = DEREFERENCE) {
    const codecType = codecsArray.find(codecType => codecType.test(value)) // first match wins
    if (!codecType) {
      logError(() => console.error('no match', value))
      throw new Error('no encoder for value')
    }
    const uint8Array = codecType.encode(value, dictionary, options)
    return { uint8Array, codecType }
  }

  getCodecTypeVersion (footer) {
    const codecVersion = this.codecTypeVersionsByFooter[footer]
    if (!codecVersion) {
      throw new Error(`getCodecTypeVersion failed for footer: ${footer}`)
    }
    return codecVersion
  }

  getCodecType (name) { return this.codecTypesByName[name] }
  deriveFooter (codecType, versionArrays) {
    const footerByCombinedVersions = this.footerByCodecTypeAndCombinedVersions.get(codecType)
    const combinedVersion = toCombinedVersion(versionArrays, codecType.versionArrayCounts)
    return footerByCombinedVersions[combinedVersion]
  }

  /**
   * @param {U8aTurtle} u8aTurtle
   * @param {number} address
   */
  extractEncodedValue (u8aTurtle, address = u8aTurtle.length - 1) {
    const codecVersion = this.extractCodecTypeVersion(u8aTurtle, address)
    if (!codecVersion) {
      logError(() => console.error({ address, footer: u8aTurtle.getByte(address) }))
      throw new Error('no decoder for footer')
    }
    const width = codecVersion.getWidth(u8aTurtle, address)
    return u8aTurtle.slice(address - width, address + 1) // include footer
  }

  /**
   * @param {U8aTurtle} u8aTurtle
   * @param {number} address
   */
  extractCodecTypeVersion (u8aTurtle, address = u8aTurtle.length - 1) {
    const footer = u8aTurtle.getByte(address)
    return this.getCodecTypeVersion(footer)
  }

  /**
   * @param {CodecType} codecType
   */
  addCodecType (codecType, testFirst = false) {
    const versionCount = toVersionCount(codecType.versionArrayCounts)
    const footerByVersion = new Array(versionCount)
    for (let combinedVersion = 0; combinedVersion < versionCount; ++combinedVersion) {
      const footer = this.codecTypeVersionsByFooter.length
      footerByVersion[combinedVersion] = footer
      this.codecTypeVersionsByFooter.push(new CodecTypeVersion(codecType, combinedVersion))
    }
    this.footerByCodecTypeAndCombinedVersions.set(codecType, footerByVersion)
    this.codecTypesByName[codecType.name] = codecType
    if (testFirst) this.codecTypes.unshift(codecType)
    else this.codecTypes.push(codecType)
  }
}
