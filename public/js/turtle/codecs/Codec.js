import { combineUint8ArrayLikes, encodeNumberToU8a, toCombinedVersion, toSubVersions, toVersionCount } from '../utils.js'
import { codecVersionByFooter } from './codecs.js'

/**
 * @typedef CodecOptions
 * @property {boolean} keysAsRefs
 * @property {boolean} valuesAsRefs
 */
export const AS_REFS = { keysAsRefs: false, valuesAsRefs: true }
export const DEREFERENCE = { keysAsRefs: false, valuesAsRefs: false }

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
  decode (u8aTurtle, address, options = DEREFERENCE) {
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
  let valueRefs = objectRefs.slice(keyRefs.length)
  if (!options.keysAsRefs) keyRefs = keyRefs.map(key => u8aTurtle.lookup(key))
  if (!options.valuesAsRefs) valueRefs = valueRefs.map(value => u8aTurtle.lookup(value))
  return keyRefs.map((key, index) => [key, valueRefs[index]])
}

/**
 * @param {Array.<[any,any]>} entries
 * @param {import('../TurtleDictionary.js').TurtleDictionary} dictionary
 * @param {CodecOptions} options
 */
export const entriesToObjectRefs = (entries, dictionary, options) => {
  let keyRefs = []
  let valueRefs = []
  entries.forEach(([key, value]) => {
    keyRefs.push(key)
    valueRefs.push(value)
  })
  if (options.keysAsRefs) keyRefs = keyRefs.map(key => +key)
  else keyRefs = keyRefs.map(key => dictionary.upsert(key))
  if (!options.valuesAsRefs) valueRefs = valueRefs.map(value => dictionary.upsert(value))
  return [...keyRefs, ...valueRefs]
}

/**
 * @param {Codec} codec
 * @param {number} address
 * @param {number} minAddressBytes
 * @param  {...number} subversions
 * @returns {Uint8Array}
 */
export function encodeAddress (codec, address, minAddressBytes, ...subversions) {
  const u8aAddress = encodeNumberToU8a(address, minAddressBytes)
  const footer = codec.footerFromSubVersions([u8aAddress.length - minAddressBytes, ...subversions])
  return combineUint8ArrayLikes([u8aAddress, footer])
}
