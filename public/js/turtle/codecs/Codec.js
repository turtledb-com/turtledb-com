import { toCombinedVersion, toSubVersions, toVersionCount } from '../utils.js'
import { codecVersionByFooter } from './codecs.js'

/**
 * @typedef CodecOptions
 * @property {boolean} keysAsRefs
 * @property {boolean} valuesAsRefs
 */

export class Codec {
  /**
   * @param {{
   *  name: string,
   *  test: (value:any) => boolean,
   *  decode: (uint8Array: Uint8Array, codecVersion: CodecVersion, u8aTurtle: import('../U8aTurtle.js').U8aTurtle, options: CodecOptions) => any,
   *  encode: (value: any, codec: Codec, dictionary: import('../TurtleDictionary.js').TurtleDictionary, options: CodecOptions) => Uint8Array,
   *  getWidth: (codecVersion: CodecVersion) => number,
   *  subVersionCounts: Array.<number>,
   *  isOpaque: boolean
   * }}
   */
  constructor ({ name, test, decode, encode, getWidth, subVersionCounts, isOpaque }) {
    this.name = name
    this.test = test
    this.decode = decode
    this.encode = encode
    this.getWidth = getWidth
    this.subVersionCounts = subVersionCounts
    this.isOpaque = isOpaque
    this.versionCount = toVersionCount(subVersionCounts)
    this.footerByVersion = new Array(this.versionCount)
    for (let combinedVersion = 0; combinedVersion < this.versionCount; ++combinedVersion) {
      this.footerByVersion[combinedVersion] = codecVersionByFooter.length
      codecVersionByFooter.push(new CodecVersion(this, combinedVersion))
    }
  }

  /**
   * @param {Array.<number>} subVersions
   * @returns number
   */
  footerFromSubVersions (subVersions) {
    return this.footerByVersion[toCombinedVersion(subVersions, this.subVersionCounts)]
  }
}

export class CodecVersion {
  /**
   * @param {Codec} codec
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
   * @param {import('./Codec.js').CodecOptions} options
   */
  decode (u8aTurtle, address, options) {
    const width = this.width
    const uint8Array = u8aTurtle.slice(address - width, address)
    const value = this.codec.decode(uint8Array, this, u8aTurtle, options)
    return value
  }
}

/**
 * @param {Array} objectRefs
 * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
 * @param {CodecOptions} options
 * @returns
 */
export const objectRefsToEntries = (objectRefs, u8aTurtle, options) => {
  let keyRefs = objectRefs.slice(0, objectRefs.length / 2)
  const valueRefs = objectRefs.slice(keyRefs.length)
  if (options?.valuesAsRefs) keyRefs = keyRefs.map(key => u8aTurtle.lookup(key))
  return keyRefs.map((key, index) => [key, valueRefs[index]])
}

/**
 * @param {Array.<[any,any]>} entries
 * @param {CodecOptions} options
 */
export const entriesToObjectRefs = (entries, options) => {
  const keyRefs = []
  const valueRefs = []
  entries.forEach(([key, value]) => {
    keyRefs.push(key)
    valueRefs.push(value)
  })
  return [...keyRefs, ...valueRefs]
}