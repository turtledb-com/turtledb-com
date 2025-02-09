import { toCombinedVersion, toVersionCount } from '../utils.js'
import { DEREFERENCE } from './CodecType.js'
import { CodecTypeVersion } from './CodecTypeVersion.js'

export class CompositeCodec {
  /** @type {Array.<import('./CodecType.js').CodecType>} */
  codecTypes = []
  /** @type {Object.<string, import('./CodecType.js').CodecType>} */
  codecTypesByName = {}
  /** @type {Array.<CodecTypeVersion>} */
  codecTypeVersionsByFooter = []
  /** @type {Map.<import('./CodecType.js').CodecType, Array} */
  footerByCodecTypeAndCombinedVersions = new Map()

  encodeValue (value, codecsArray = this.codecTypes, dictionary, options = DEREFERENCE) {
    const codecType = codecsArray.find(codecType => codecType.test(value)) // first match wins
    if (!codecType) {
      console.error('no match', value)
      throw new Error('no encoder for value')
    }
    const uint8Array = codecType.encode(value, codecType, dictionary, options)
    return { uint8Array, codecType }
  }

  getCodecTypeVersion (footer) { return this.codecTypeVersionsByFooter[footer] }
  getCodecType (name) { return this.codecTypesByName[name] }
  deriveFooter (codecType, versionArrays) {
    const footerByCombinedVersions = this.footerByCodecTypeAndCombinedVersions.get(codecType)
    const combinedVersion = toCombinedVersion(versionArrays, codecType.versionArrayCounts)
    return footerByCombinedVersions[combinedVersion]
  }

  /**
   * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
   * @param {number} address
   */
  extractEncodedValue (u8aTurtle, address = u8aTurtle.length - 1) {
    const codecVersion = this.extractCodecTypeVersion(u8aTurtle, address)
    if (!codecVersion) {
      console.error({ address, footer: u8aTurtle.getByte(address) })
      throw new Error('no decoder for footer')
    }
    const width = codecVersion.getWidth(u8aTurtle, address)
    return u8aTurtle.slice(address - width, address + 1) // include footer
  }

  /**
   * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
   * @param {number} address
   */
  extractCodecTypeVersion (u8aTurtle, address = u8aTurtle.length - 1) {
    const footer = u8aTurtle.getByte(address)
    return this.getCodecTypeVersion(footer)
  }

  /**
   * @param {import('./CodecType.js').CodecType} codecType
   */
  addCodecType (codecType) {
    const versionCount = toVersionCount(codecType.versionArrayCounts)
    const footerByVersion = new Array(versionCount)
    for (let combinedVersion = 0; combinedVersion < versionCount; ++combinedVersion) {
      const footer = this.codecTypeVersionsByFooter.length
      footerByVersion[combinedVersion] = footer
      this.codecTypeVersionsByFooter.push(new CodecTypeVersion(codecType, combinedVersion))
    }
    this.footerByCodecTypeAndCombinedVersions.set(codecType, footerByVersion)
    this.codecTypesByName[codecType.name] = codecType
    this.codecTypes.push(codecType)
  }
}
