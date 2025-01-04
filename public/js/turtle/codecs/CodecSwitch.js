import { toCombinedVersion, toVersionCount } from '../utils.js'
import { CodecType } from './CodecType.js'
import { CodecTypeVersion } from './CodecTypeVersion.js'

export class CodecSwitch {
  /** @type {Object.<string, CodecType>} */
  codecTypesByName = {}
  /** @type {Array.<CodecTypeVersion>} */
  codecTypeVersionsByFooter = []
  /** @type {Map.<CodecType, Array} */
  footerByCodecAndCombinedVersions = new Map()

  getCodecTypeVersion (footer) { return this.codecTypeVersionsByFooter[footer] }
  getCodecType (name) { return this.codecTypesByName[name] }
  getFooter (codec, subVersions) {
    const footerByCombinedVersions = this.footerByCodecAndCombinedVersions.get(codec)
    const combinedVersion = toCombinedVersion(subVersions, codec.subVersionCounts)
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
    const codec = new CodecType(properties)
    const versionCount = toVersionCount(properties.subVersionCounts)
    const footerByVersion = new Array(versionCount)
    for (let combinedVersion = 0; combinedVersion < versionCount; ++combinedVersion) {
      const footer = this.codecTypeVersionsByFooter.length
      footerByVersion[combinedVersion] = footer
      this.codecTypeVersionsByFooter.push(new CodecTypeVersion(codec, combinedVersion))
    }
    this.footerByCodecAndCombinedVersions.set(codec, footerByVersion)
    this.codecTypesByName[properties.name] = codec
  }
}
