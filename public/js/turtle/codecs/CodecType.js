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
   *  decode: (uint8Array: Uint8Array, codecTypeVersion: import('./CodecTypeVersion.js').CodecTypeVersion, u8aTurtle: import('../U8aTurtle.js').U8aTurtle, options: CodecOptions) => any,
   *  encode: (value: any, dictionary: import('../TurtleDictionary.js').TurtleDictionary, options: CodecOptions) => Uint8Array,
   *  getWidth: (codecTypeVersion: import('./CodecTypeVersion.js').CodecTypeVersion, u8aTurtle: import('../U8aTurtle.js').U8aTurtle, index: number) => number,
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
