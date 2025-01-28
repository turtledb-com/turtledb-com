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
  getFooter (codecType, versionArrays) {
    const footerByCombinedVersions = this.footerByCodecTypeAndCombinedVersions.get(codecType)
    const combinedVersion = toCombinedVersion(versionArrays, codecType.versionArrayCounts)
    return footerByCombinedVersions[combinedVersion]
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
