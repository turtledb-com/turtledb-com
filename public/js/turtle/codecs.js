import { combineUint8ArrayLikes, combineUint8Arrays, decodeNumberFromU8a, encodeNumberToU8a, toCombinedVersion, toSubVersions, toVersionCount } from './utils.js'

const minAddressBytes = 1
const maxAddressBytes = 4
const addressVersions = maxAddressBytes - minAddressBytes + 1
const maxWordLength = 4
const wordLengthVersions = maxWordLength + 1

/** @type {Array.<CodecVersion>} */
export const codecVersionByFooter = []

/** @type {Object.<string, Codec>} */
export const codecs = {}

/**
 * @typedef DecodeOptions
 * @property {boolean} asRef
 */

/**
 * @param {Array} ksVs
 * @param {import('./U8aTurtle.js').U8aTurtle} u8aTurtle
 * @param {DecodeOptions} options
 * @returns
 */
const ksVsToEntries = (ksVs, u8aTurtle, options) => {
  const length = ksVs.length / 2
  if (options?.asRef) {
    return ksVs.slice(0, length).map((k, i) => [u8aTurtle.lookup(k), ksVs[length + i]])
  }
  return ksVs.slice(0, length).map((k, i) => [k, ksVs[length + i]])
}

class CodecVersion {
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
   * @param {import('./U8aTurtle.js').U8aTurtle} u8aTurtle
   * @param {number} address
   * @param {DecodeOptions} options
   */
  decode (u8aTurtle, address, options) {
    const width = this.width
    const uint8Array = u8aTurtle.slice(address - width, address)
    const value = this.codec.decode(uint8Array, this, u8aTurtle, options)
    return value
  }
}

class Codec {
  /**
   * @param {{
   *  name: string,
   *  test: (value:any) => boolean,
   *  decode: (uint8Array: Uint8Array, codecVersion: CodecVersion, u8aTurtle: import('./U8aTurtle.js').U8aTurtle, options: DecodeOptions) => any,
   *  encode: (value: any, codec: Codec, dictionaryTurtle: DictionaryTurtle) => Uint8Array,
   *  getWidth: (codecVersion: CodecVersion) => number,
   *  subVersionCounts: Array.<number>,
   * }}
   */
  constructor ({ name, test, decode, encode, getWidth, subVersionCounts }) {
    this.name = name
    this.test = test
    this.decode = decode
    this.encode = encode
    this.getWidth = getWidth
    this.subVersionCounts = subVersionCounts
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

class TreeNode {
  /**
   * @param {number} leftAddress
   * @param {number} rightAddress
   * @param {import('./U8aTurtle.js').U8aTurtle;} u8aTurtle
   * @param {DecodeOptions} options
   */
  constructor (leftAddress, rightAddress, u8aTurtle, options) {
    this.leftAddress = leftAddress
    this.rightAddress = rightAddress
    this.u8aTurtle = u8aTurtle
    this.options = options
  }

  * inOrder () {
    const left = this.u8aTurtle.lookup(this.leftAddress, this.options)
    if (left instanceof TreeNode) yield * left.inOrder()
    else if (this.options?.asRef) yield this.leftAddress
    else yield left
    const right = this.u8aTurtle.lookup(this.rightAddress, this.options)
    if (right instanceof TreeNode) yield * right.inOrder()
    else if (this.options?.asRef) yield this.rightAddress
    else yield right
  }
}

export const UNDEFINED = 'undefined'
codecs[UNDEFINED] = new Codec({
  name: UNDEFINED,
  test: value => value === undefined,
  decode: (_uint8Array, _codecVersion, _dictionaryTurtle) => undefined,
  encode: (_value, codec) => new Uint8Array([codec.footerFromSubVersions([0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const NULL = 'null'
codecs[NULL] = new Codec({
  name: NULL,
  test: value => value === null,
  decode: (_uint8Array, _codecVersion, _dictionaryTurtle) => null,
  encode: (_value, codec, _dictionaryTurtle) => new Uint8Array([codec.footerFromSubVersions([0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const FALSE = 'boolean(false)'
codecs[FALSE] = new Codec({
  name: FALSE,
  test: value => value === false,
  decode: (_uint8Array, _codecVersion, _dictionaryTurtle) => false,
  encode: (_value, codec, _dictionaryTurtle) => new Uint8Array([codec.footerFromSubVersions([0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const TRUE = 'boolean(true)'
codecs[TRUE] = new Codec({
  name: TRUE,
  test: value => value === true,
  decode: (_uint8Array, _codecVersion, _dictionaryTurtle) => true,
  encode: (_value, codec, _dictionaryTurtle) => new Uint8Array([codec.footerFromSubVersions([0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const NUMBER = 'number'
codecs[NUMBER] = new Codec({
  name: NUMBER,
  test: value => typeof value === 'number',
  decode: (uint8Array, _codecVersion, _dictionaryTurtle) => new Float64Array(uint8Array.buffer)[0],
  encode: (value, codec, _dictionaryTurtle) => combineUint8ArrayLikes([new Float64Array([value]), codec.footerFromSubVersions([0])]),
  getWidth: () => 8,
  subVersionCounts: [1]
})

export const STRING = 'string'
codecs[STRING] = new Codec({
  name: STRING,
  test: value => typeof value === 'string',
  decode: (uint8Array, _codecVersion, u8aTurtle) => {
    const stringAsU8a = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    return new TextDecoder().decode(stringAsU8a)
  },
  encode: (value, codec, dictionaryTurtle) => {
    const stringAsU8a = new TextEncoder().encode(value)
    const address = encodeNumberToU8a(dictionaryTurtle.upsert(stringAsU8a), minAddressBytes)
    return combineUint8ArrayLikes([address, codec.footerFromSubVersions([address.length - minAddressBytes])])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const DATE = 'date'
codecs[DATE] = new Codec({
  name: DATE,
  test: value => value instanceof Date,
  decode: (uint8Array, _codecVersion, _dictionaryTurtle) => new Date(new Float64Array(uint8Array.buffer)[0]),
  encode: (value, codec, _dictionaryTurtle) => combineUint8ArrayLikes([new Float64Array([value.getTime()]), codec.footerFromSubVersions([0])]),
  getWidth: () => 8,
  subVersionCounts: [1]
})

export const BIGINT = 'bigint'
codecs[BIGINT] = new Codec({
  name: BIGINT,
  test: value => typeof value === 'bigint',
  decode: (uint8Array, codecVersion, u8aTurtle) => {
    const sign = codecVersion.subVersions[1] ? -1n : 1n
    const hex = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    return sign * BigInt(`0x${[...hex].map(byte => `0${byte.toString(16)}`.slice(-2)).join('')}`)
  },
  encode: (value, codec, dictionaryTurtle) => {
    const signVersion = value < 0n ? 1 : 0
    const sign = value < 0n ? -1n : 1n
    let bigintHex = (sign * value).toString(16)
    if (bigintHex.length % 2) bigintHex = `0${bigintHex}`
    const uint8Array = new Uint8Array(bigintHex.match(/.{1,2}/g).map(hex => parseInt(hex, 16)))
    const address = encodeNumberToU8a(dictionaryTurtle.upsert(uint8Array))
    return combineUint8ArrayLikes([address, codec.footerFromSubVersions([address.length - minAddressBytes, signVersion])])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions, 2]
})

export const WORD = 'word (<= 4-bytes)'
codecs[WORD] = new Codec({
  name: WORD,
  test: value => value instanceof Uint8Array && value.length < wordLengthVersions,
  decode: (uint8Array, _codecVersion, _dictionaryTurtle) => uint8Array,
  encode: (value, codec, _dictionaryTurtle) => combineUint8ArrayLikes([value, codec.footerFromSubVersions([value.length])]),
  getWidth: codecVersion => codecVersion.subVersions[0],
  subVersionCounts: [wordLengthVersions]
})

const TypedArrays = [Uint8Array, Int8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array]
export const TYPED_ARRAY = 'typed array'
codecs[TYPED_ARRAY] = new Codec({
  name: TYPED_ARRAY,
  test: value => (value instanceof Object.getPrototypeOf(Uint8Array)),
  decode: (uint8Array, codecVersion, u8aTurtle) => {
    let value = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    if (value instanceof TreeNode) value = combineUint8Arrays([...value.inOrder()])
    else if (value.length === 0) value = new Uint8Array()
    const TypedArray = TypedArrays[codecVersion.subVersions[1]]
    return new TypedArray(value.buffer)
  },
  encode: (value, codec, dictionaryTurtle) => {
    const typedArrayVersion = TypedArrays.findIndex(TypedArray => value instanceof TypedArray)
    if (!(value instanceof Uint8Array)) value = new Uint8Array(value.buffer)
    let address
    if (value.length === 0) address = encodeNumberToU8a(dictionaryTurtle.upsert([], [codecs[EMPTY_ARRAY]]), minAddressBytes)
    if (codecs[WORD].test(value)) address = encodeNumberToU8a(dictionaryTurtle.upsert(value, [codecs[WORD]]), minAddressBytes)
    else {
      const wordsLength = Math.ceil(value.length / maxWordLength)
      const words = new Array(wordsLength)
      for (let i = 0; i < wordsLength; ++i) {
        words[i] = value.slice(i * maxWordLength, (i + 1) * maxWordLength)
      }
      address = encodeNumberToU8a(dictionaryTurtle.upsert(words, [codecs[TREE_NODE]]), minAddressBytes)
    }
    return combineUint8ArrayLikes([address, codec.footerFromSubVersions([address.length - minAddressBytes, typedArrayVersion])])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions, TypedArrays.length]
})

export const EMPTY_ARRAY = 'array(length==0)'
codecs[EMPTY_ARRAY] = new Codec({
  name: EMPTY_ARRAY,
  test: value => Array.isArray(value) && value.length === 0,
  decode: (_uint8Array, _codecVersion, _dictionaryTurtle) => [],
  encode: (_value, codec, _dictionaryTurtle) => new Uint8Array([codec.footerFromSubVersions([0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const NONEMPTY_ARRAY = 'array(length>1)'
codecs[NONEMPTY_ARRAY] = new Codec({
  name: NONEMPTY_ARRAY,
  test: value => Array.isArray(value),
  decode: (uint8Array, codecVersion, u8aTurtle, options) => {
    const address = decodeNumberFromU8a(uint8Array)
    const treeNode = u8aTurtle.lookup(address, options)
    if (codecVersion.subVersions[1]) return Object.assign([], treeNode)
    if (treeNode instanceof TreeNode) return [...treeNode.inOrder()]
    return options?.asRef ? [address] : [treeNode]
  },
  encode: (value, codec, dictionaryTurtle) => {
    let address
    let sparse = 0
    if (JSON.stringify(Object.keys(value)) !== JSON.stringify(Object.keys([...value]))) {
      address = encodeNumberToU8a(dictionaryTurtle.upsert(Object.assign({}, value, { length: value.length }), [codecs[OBJECT]]))
      sparse = 1
    } else if (value.length === 1) address = encodeNumberToU8a(dictionaryTurtle.upsert(value[0]), minAddressBytes)
    else address = encodeNumberToU8a(dictionaryTurtle.upsert(value, [codecs[TREE_NODE]]), minAddressBytes)
    return combineUint8ArrayLikes([address, codec.footerFromSubVersions([address.length - minAddressBytes, sparse])])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions, 2]
})

export const SET = 'set'
codecs[SET] = new Codec({
  name: SET,
  test: value => value instanceof Set,
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return new Set(u8aTurtle.lookup(decodeNumberFromU8a(uint8Array), options))
  },
  encode: (value, codec, dictionaryTurtle) => {
    const objectAsArray = [...value.values()]
    const address = encodeNumberToU8a(dictionaryTurtle.upsert(objectAsArray), minAddressBytes)
    return combineUint8ArrayLikes([address, codec.footerFromSubVersions([address.length - minAddressBytes])])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const MAP = 'map'
codecs[MAP] = new Codec({
  name: MAP,
  test: value => value instanceof Map,
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return new Map(ksVsToEntries(
      u8aTurtle.lookup(decodeNumberFromU8a(uint8Array), options),
      u8aTurtle,
      options
    ))
  },
  encode: (value, codec, dictionaryTurtle) => {
    const objectAsArray = [...value.keys(), ...value.values()]
    const address = encodeNumberToU8a(dictionaryTurtle.upsert(objectAsArray), minAddressBytes)
    return combineUint8ArrayLikes([address, codec.footerFromSubVersions([address.length - minAddressBytes])])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const OBJECT = 'object'
codecs[OBJECT] = new Codec({
  name: OBJECT,
  test: value => typeof value === 'object',
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return Object.fromEntries(ksVsToEntries(
      u8aTurtle.lookup(decodeNumberFromU8a(uint8Array), options),
      u8aTurtle,
      options
    ))
  },
  encode: (value, codec, dictionaryTurtle) => {
    const objectAsArray = [...Object.keys(value), ...Object.values(value)]
    const address = encodeNumberToU8a(dictionaryTurtle.upsert(objectAsArray), minAddressBytes)
    return combineUint8ArrayLikes([address, codec.footerFromSubVersions([address.length - minAddressBytes])])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const TREE_NODE = 'tree-node'
codecs[TREE_NODE] = new Codec({
  name: TREE_NODE,
  test: value => Array.isArray(value) && value.length > 1,
  decode: (uint8Array, codecVersion, u8aTurtle, options) => {
    const [leftAddressLength] = codecVersion.subVersions
    const leftAddress = decodeNumberFromU8a(uint8Array.slice(0, leftAddressLength + minAddressBytes))
    const rightAddress = decodeNumberFromU8a(uint8Array.slice(leftAddressLength + minAddressBytes))
    return new TreeNode(leftAddress, rightAddress, u8aTurtle, options)
  },
  encode: (value, codec, dictionaryTurtle) => {
    const leftLength = 2 ** (31 - Math.clz32(value.length - 1))
    let leftAddress
    if (leftLength === 1) leftAddress = encodeNumberToU8a(dictionaryTurtle.upsert(value[0]), minAddressBytes)
    else leftAddress = encodeNumberToU8a(dictionaryTurtle.upsert(value.slice(0, leftLength), [codecs[TREE_NODE]]), minAddressBytes)
    let rightAddress
    if (value.length === leftLength + 1) rightAddress = encodeNumberToU8a(dictionaryTurtle.upsert(value[value.length - 1]), minAddressBytes)
    else rightAddress = encodeNumberToU8a(dictionaryTurtle.upsert(value.slice(leftLength), [codecs[TREE_NODE]]), minAddressBytes)
    const footer = codec.footerFromSubVersions([leftAddress.length - minAddressBytes, rightAddress.length - minAddressBytes])
    return combineUint8ArrayLikes([leftAddress, rightAddress, footer])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + codecVersion.subVersions[1] + 2 * (minAddressBytes),
  subVersionCounts: [addressVersions, addressVersions]
})

console.log(codecVersionByFooter.map((codecVersion, index) => `${index}: { name: "${codecVersion.codec.name}", width: ${codecVersion.width}, subVersions: ${JSON.stringify(codecVersion.subVersions)} }`).join('\n'))
