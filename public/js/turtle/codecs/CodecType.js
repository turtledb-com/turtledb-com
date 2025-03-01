/**
 * @typedef {import('./CodecTypeVersion.js').CodecTypeVersion} CodecTypeVersion
 * @typedef {import('../U8aTurtle.js').U8aTurtle} U8aTurtle
 * @typedef {import('../TurtleDictionary.js').TurtleDictionary} TurtleDictionary
 */

/**
 * @typedef CodecOptions
 * @property {boolean} keysAsRefs
 * @property {boolean} valuesAsRefs
 */
export const AS_REFS = { keysAsRefs: false, valuesAsRefs: true }
export const DEREFERENCE = { keysAsRefs: false, valuesAsRefs: false }

export class CodecType {
  /**
   * @param {{
   *  name: string,
   *  test: (value:any) => boolean,
   *  decode: (uint8Array: Uint8Array, codecTypeVersion: CodecTypeVersion, u8aTurtle: U8aTurtle, options: CodecOptions) => any,
   *  encode: (value: any, dictionary: TurtleDictionary, options: CodecOptions) => Uint8Array,
   *  getWidth: (codecTypeVersion: CodecTypeVersion, u8aTurtle: U8aTurtle, index: number) => number,
   *  versionArrayCounts: Array.<number>,
   *  isOpaque: boolean
   * }}
   */
  constructor ({ name, test, decode, encode, getWidth, versionArrayCounts, isOpaque }) {
    this.name = name
    this.test = test
    this.decode = decode
    this.encode = encode
    this.getWidth = getWidth
    this.versionArrayCounts = versionArrayCounts
    this.isOpaque = isOpaque
  }
}
