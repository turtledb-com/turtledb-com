import { toCombinedVersion, toVersionCount } from '../utils.js'
import { CodecType, DEREFERENCE } from './CodecType.js'
import { CodecTypeVersion } from './CodecTypeVersion.js'

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
      console.error('no match', value)
      throw new Error('no encoder for value')
    }
    const uint8Array = codecType.encode(value, codecType, dictionary, options)
    return { uint8Array, codecType }
  }

  getCodecTypeVersion (footer) { return this.codecTypeVersionsByFooter[footer] }
  getCodecType (name) { return this.codecTypesByName[name] }
  getFooter (codecType, subVersions) {
    const footerByCombinedVersions = this.footerByCodecTypeAndCombinedVersions.get(codecType)
    const combinedVersion = toCombinedVersion(subVersions, codecType.subVersionCounts)
    return footerByCombinedVersions[combinedVersion]
  }

  /**
   * @param {{
   *  name: string,
   *  codecVersionByFooter: Array.<CodecTypeVersion>,
   *  test: (value:any) => boolean,
   *  decode: (uint8Array: Uint8Array, codecVersion: CodecTypeVersion, u8aTurtle: import('../U8aTurtle.js').U8aTurtle, options: CodecOptions) => any,
   *  encode: (value: any, codec: CodecType, dictionary: import('../TurtleDictionary.js').TurtleDictionary, options: CodecOptions) => Uint8Array,
   *  getWidth: (codecVersion: CodecTypeVersion) => number,
   *  subVersionCounts: Array.<number>,
   *  isOpaque: boolean
   * }} properties
   */
  addCodecType (properties) {
    const codecType = new CodecType(properties)
    const versionCount = toVersionCount(properties.subVersionCounts)
    const footerByVersion = new Array(versionCount)
    for (let combinedVersion = 0; combinedVersion < versionCount; ++combinedVersion) {
      const footer = this.codecTypeVersionsByFooter.length
      footerByVersion[combinedVersion] = footer
      this.codecTypeVersionsByFooter.push(new CodecTypeVersion(codecType, combinedVersion))
    }
    this.footerByCodecTypeAndCombinedVersions.set(codecType, footerByVersion)
    this.codecTypesByName[properties.name] = codecType
    this.codecTypes.push(codecType)
  }
}
