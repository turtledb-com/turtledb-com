import { combineUint8ArrayLikes, combineUint8Arrays, decodeNumberFromU8a, encodeNumberToU8a } from '../utils.js'
import { CodecType } from './CodecType.js'
import { Commit } from './Commit.js'
import { CompositeCodec } from './CompositeCodec.js'
import { TreeNode } from './TreeNode.js'

/**
 * @typedef {import('../U8aTurtle.js').U8aTurtle} U8aTurtle
 * @typedef {import('../TurtleDictionary.js').TurtleDictionary} TurtleDictionary
 * @typedef {import('./CodecType.js').CodecType} CodecType
 * @typedef {import('./CodecType.js').CodecOptions} CodecOptions
 */

export const codec = new CompositeCodec()

const minAddressBytes = 1
const maxAddressBytes = 4
const addressVersions = maxAddressBytes - minAddressBytes + 1
const maxWordLength = 4
const wordLengthVersions = maxWordLength + 1
const TypedArrays = [Uint8Array, Int8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array]

/**
 * @param {Array} objectRefs
 * @param {U8aTurtle} u8aTurtle
 * @param {CodecOptions} options
 * @returns {Array.<[any, any]>}
 */
const objectRefsToEntries = (objectRefs, u8aTurtle, options) => {
  let keyRefs = objectRefs.slice(0, objectRefs.length / 2)
  let valueRefs = objectRefs.slice(keyRefs.length)
  if (!options.keysAsRefs) keyRefs = keyRefs.map(key => u8aTurtle.lookup(key))
  if (!options.valuesAsRefs) valueRefs = valueRefs.map(value => u8aTurtle.lookup(value))
  return keyRefs.map((key, index) => [key, valueRefs[index]])
}

/**
 * @param {Array.<[any,any]>} entries
 * @param {TurtleDictionary} dictionary
 * @param {CodecOptions} options
 * @returns {Array}
 */
const entriesToObjectRefs = (entries, dictionary, options) => {
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
 * @param {U8aTurtle} u8aTurtle
 * @returns {[Uint8Array, Uint8Array]}
 */
export function splitEncodedCommit (u8aTurtle) {
  if (codec.codecTypeVersionsByFooter[u8aTurtle.getByte()].codecType.name !== COMMIT) {
    throw new Error('non-commit found where commit is expected')
  }
  const encodedCommit = codec.extractEncodedValue(u8aTurtle)
  const encodedData = u8aTurtle.uint8Array.slice(0, -encodedCommit.length)
  return [encodedData, encodedCommit]
}

/**
 * @param {CodecType} codecType
 * @param {number} address
 * @param {number} minAddressBytes
 * @param  {...number} subversions
 * @returns {Uint8Array}
 */
function encodeAddress (codecType, address, minAddressBytes, ...subversions) {
  const u8aAddress = encodeNumberToU8a(address, minAddressBytes)
  const footer = codec.deriveFooter(codecType, [u8aAddress.length - minAddressBytes, ...subversions])
  return combineUint8ArrayLikes([u8aAddress, footer])
}

export const UNDEFINED = 'undefined'
export const UNDEFINED_TYPE = new CodecType({
  name: UNDEFINED,
  test: value => value === undefined,
  decode: (_uint8Array, _codecVersion, _dictionary) => undefined,
  encode: (_value, _dictionary) => new Uint8Array([codec.deriveFooter(UNDEFINED_TYPE, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
})
codec.addCodecType(UNDEFINED_TYPE)

export const NULL = 'null'
export const NULL_TYPE = new CodecType({
  name: NULL,
  test: value => value === null,
  decode: (_uint8Array, _codecVersion, _dictionary) => null,
  encode: (_value, _dictionary) => new Uint8Array([codec.deriveFooter(NULL_TYPE, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
})
codec.addCodecType(NULL_TYPE)

export const FALSE = 'boolean(false)'
export const FALSE_TYPE = new CodecType({
  name: FALSE,
  test: value => value === false,
  decode: (_uint8Array, _codecVersion, _dictionary) => false,
  encode: (_value, _dictionary) => new Uint8Array([codec.deriveFooter(FALSE_TYPE, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
})
codec.addCodecType(FALSE_TYPE)

export const TRUE = 'boolean(true)'
export const TRUE_TYPE = new CodecType({
  name: TRUE,
  test: value => value === true,
  decode: (_uint8Array, _codecVersion, _dictionary) => true,
  encode: (_value, _dictionary) => new Uint8Array([codec.deriveFooter(TRUE_TYPE, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
})
codec.addCodecType(TRUE_TYPE)

export const NUMBER = 'number'
export const NUMBER_TYPE = new CodecType({
  name: NUMBER,
  test: value => typeof value === 'number',
  decode: (uint8Array, _codecVersion, _dictionary) => new Float64Array(uint8Array.buffer)[0],
  encode: (value, _dictionary) => combineUint8ArrayLikes([new Float64Array([value]), codec.deriveFooter(NUMBER_TYPE, [0])]),
  getWidth: () => 8,
  versionArrayCounts: [1]
})
codec.addCodecType(NUMBER_TYPE)

export const STRING = 'string'
const STRING_TYPE = new CodecType({
  name: STRING,
  test: value => typeof value === 'string',
  decode: (uint8Array, _codecVersion, u8aTurtle) => {
    const stringAsU8a = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    return new TextDecoder().decode(stringAsU8a)
  },
  encode: (value, dictionary) => {
    const stringAsU8a = new TextEncoder().encode(value)
    const address = dictionary.upsert(stringAsU8a)
    return encodeAddress(STRING_TYPE, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
})
codec.addCodecType(STRING_TYPE)

export const DATE = 'date'
export const DATE_TYPE = new CodecType({
  name: DATE,
  test: value => value instanceof Date,
  decode: (uint8Array, _codecVersion, _dictionary) => new Date(new Float64Array(uint8Array.buffer)[0]),
  encode: (value, _dictionary) => combineUint8ArrayLikes([new Float64Array([value.getTime()]), codec.deriveFooter(DATE_TYPE, [0])]),
  getWidth: () => 8,
  versionArrayCounts: [1]
})
codec.addCodecType(DATE_TYPE)

export const BIGINT = 'bigint'
export const BIGINT_TYPE = new CodecType({
  name: BIGINT,
  test: value => typeof value === 'bigint',
  decode: (uint8Array, codecVersion, u8aTurtle) => {
    const sign = codecVersion.versionArrays[1] ? -1n : 1n
    const hex = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    return sign * BigInt(`0x${[...hex].map(byte => `0${byte.toString(16)}`.slice(-2)).join('')}`)
  },
  encode: (value, dictionary) => {
    const signVersion = value < 0n ? 1 : 0
    const sign = value < 0n ? -1n : 1n
    let bigintHex = (sign * value).toString(16)
    if (bigintHex.length % 2) bigintHex = `0${bigintHex}`
    const uint8Array = new Uint8Array(bigintHex.match(/.{1,2}/g).map(hex => parseInt(hex, 16)))
    const address = dictionary.upsert(uint8Array)
    return encodeAddress(BIGINT_TYPE, address, minAddressBytes, signVersion)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions, 2]
})
codec.addCodecType(BIGINT_TYPE)

export const WORD = 'word (<= 4-bytes)'
export const WORD_TYPE = new CodecType({
  name: WORD,
  test: value => value instanceof Uint8Array && value.length < wordLengthVersions,
  decode: (uint8Array, _codecVersion, _dictionary) => uint8Array,
  encode: (value, _dictionary) => combineUint8ArrayLikes([value, codec.deriveFooter(WORD_TYPE, [value.length])]),
  getWidth: codecVersion => codecVersion.versionArrays[0],
  versionArrayCounts: [wordLengthVersions]
})
codec.addCodecType(WORD_TYPE)

export const TYPED_ARRAY = 'typed array'
export const TYPED_ARRAY_TYPE = new CodecType({
  name: TYPED_ARRAY,
  test: value => (value instanceof Object.getPrototypeOf(Uint8Array)),
  decode: (uint8Array, codecVersion, u8aTurtle) => {
    let value = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    if (value instanceof TreeNode) {
      value = combineUint8Arrays([...value.inOrder(u8aTurtle)].map(address => u8aTurtle.lookup(address)))
    } else if (value.length === 0) {
      value = new Uint8Array()
    }
    const TypedArray = TypedArrays[codecVersion.versionArrays[1]]
    return new TypedArray(value.buffer)
  },
  encode: (value, dictionary) => {
    const typedArrayVersion = TypedArrays.findIndex(TypedArray => value instanceof TypedArray)
    if (!(value instanceof Uint8Array)) {
      value = new Uint8Array(value.buffer)
    }
    let address
    if (value.length === 0) {
      address = encodeNumberToU8a(dictionary.upsert([], [codec.getCodecType(EMPTY_ARRAY)]), minAddressBytes)
    }
    if (codec.getCodecType(WORD).test(value)) {
      address = dictionary.upsert(value, [codec.getCodecType(WORD)])
    } else {
      const wordsLength = Math.ceil(value.length / maxWordLength)
      const words = new Array(wordsLength)
      for (let i = 0; i < wordsLength; ++i) {
        words[i] = dictionary.upsert(value.slice(i * maxWordLength, (i + 1) * maxWordLength), [codec.getCodecType(WORD)])
      }
      address = dictionary.upsert(words, [codec.getCodecType(TREE_NODE)])
    }
    return encodeAddress(TYPED_ARRAY_TYPE, address, minAddressBytes, typedArrayVersion)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions, TypedArrays.length]
})
codec.addCodecType(TYPED_ARRAY_TYPE)

export const EMPTY_ARRAY = 'array(length==0)'
export const EMPTY_ARRAY_TYPE = new CodecType({
  name: EMPTY_ARRAY,
  test: value => Array.isArray(value) && value.length === 0,
  decode: (_uint8Array, _codecVersion, _dictionary) => [],
  encode: (_value, _dictionary) => new Uint8Array([codec.deriveFooter(EMPTY_ARRAY_TYPE, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
})
codec.addCodecType(EMPTY_ARRAY_TYPE)

export const NONEMPTY_ARRAY = 'array(length>1)'
export const NONEMPTY_ARRAY_TYPE = new CodecType({
  name: NONEMPTY_ARRAY,
  test: value => Array.isArray(value),
  decode: (uint8Array, codecVersion, u8aTurtle, options) => {
    const address = decodeNumberFromU8a(uint8Array)
    if (codecVersion.versionArrays[1]) { // is sparse array
      const arrayAsObject = u8aTurtle.lookup(address, options)
      return Object.assign([], arrayAsObject)
    }
    u8aTurtle = u8aTurtle.findParentByAddress(address)
    let refs
    if (u8aTurtle.getCodecName(address) === TREE_NODE) {
      const treeNode = u8aTurtle.lookup(address)
      refs = [...treeNode.inOrder(u8aTurtle)]
    } else {
      refs = [address]
    }
    if (!options.valuesAsRefs) {
      return refs.map(address => u8aTurtle.lookup(address))
    }
    return refs
  },
  encode: (value, dictionary, options) => {
    let address
    let isSparse = 0
    if (JSON.stringify(Object.keys(value)) !== JSON.stringify(Object.keys([...value]))) { // is sparse array
      address = dictionary.upsert(Object.assign({}, value, { length: value.length }), [codec.getCodecType(OBJECT)], options)
      isSparse = 1
    } else {
      if (!options.valuesAsRefs) value = value.map(value => dictionary.upsert(value))
      if (value.length === 1) {
        address = value[0]
      } else {
        address = dictionary.upsert(value, [codec.getCodecType(TREE_NODE)])
      }
    }
    return encodeAddress(NONEMPTY_ARRAY_TYPE, address, minAddressBytes, isSparse)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions, 2]
})
codec.addCodecType(NONEMPTY_ARRAY_TYPE)

export const SET = 'set'
export const SET_TYPE = new CodecType({
  name: SET,
  test: value => value instanceof Set,
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return new Set(u8aTurtle.lookup(decodeNumberFromU8a(uint8Array), options))
  },
  encode: (value, dictionary, options) => {
    const objectAsArray = [...value.values()]
    const address = dictionary.upsert(objectAsArray, [codec.getCodecType(EMPTY_ARRAY), codec.getCodecType(NONEMPTY_ARRAY)], options)
    return encodeAddress(SET_TYPE, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
})
codec.addCodecType(SET_TYPE)

export const MAP = 'map'
export const MAP_TYPE = new CodecType({
  name: MAP,
  test: value => value instanceof Map,
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return new Map(objectRefsToEntries(
      u8aTurtle.lookup(decodeNumberFromU8a(uint8Array)),
      u8aTurtle,
      options
    ))
  },
  encode: (value, dictionary, options) => {
    const objectRefs = entriesToObjectRefs(value.entries(), dictionary, options)
    const address = dictionary.upsert(objectRefs)
    return encodeAddress(MAP_TYPE, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
})
codec.addCodecType(MAP_TYPE)

export const COMMIT = 'commit'
export const COMMIT_TYPE = new CodecType({
  name: COMMIT,
  test: value => value instanceof Commit,
  decode: (uint8Array, codecVersion, u8aTurtle, options) => {
    const address = decodeNumberFromU8a(uint8Array.slice(0, codecVersion.versionArrays[0] + minAddressBytes))
    let signature
    if (codecVersion.versionArrays[1]) {
      signature = uint8Array.slice(-64)
    }
    const value = options.valuesAsRefs ? address : u8aTurtle.lookup(address)
    return new Commit(value, signature)
  },
  encode: (value, dictionary, options) => {
    const address = options.valuesAsRefs ? value.value : dictionary.upsert(value.value)
    if (value.signature) {
      const u8aAddress = encodeNumberToU8a(address, minAddressBytes)
      return combineUint8ArrayLikes([u8aAddress, value.signature, codec.deriveFooter(COMMIT_TYPE, [u8aAddress.length - minAddressBytes, 1])])
    }
    return encodeAddress(COMMIT_TYPE, address, minAddressBytes, 0)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes + codecVersion.versionArrays[1] * 64,
  versionArrayCounts: [addressVersions, 2],
  isOpaque: true
})
codec.addCodecType(COMMIT_TYPE)

export const OBJECT = 'object'
export const OBJECT_TYPE = new CodecType({
  name: OBJECT,
  test: value => typeof value === 'object',
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return Object.fromEntries(objectRefsToEntries(
      u8aTurtle.lookup(decodeNumberFromU8a(uint8Array)),
      u8aTurtle,
      options
    ))
  },
  encode: (value, dictionary, options) => {
    const objectRefs = entriesToObjectRefs(Object.entries(value), dictionary, options)
    const address = dictionary.upsert(objectRefs)
    return encodeAddress(OBJECT_TYPE, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
})
codec.addCodecType(OBJECT_TYPE)

export const TREE_NODE = 'tree-node'
export const TREE_NODE_TYPE = new CodecType({
  name: TREE_NODE,
  test: value => Array.isArray(value) && value.length > 1,
  decode: (uint8Array, codecVersion) => {
    const [leftAddressLength] = codecVersion.versionArrays
    const leftAddress = decodeNumberFromU8a(uint8Array.slice(0, leftAddressLength + minAddressBytes))
    const rightAddress = decodeNumberFromU8a(uint8Array.slice(leftAddressLength + minAddressBytes))
    return new TreeNode(leftAddress, rightAddress)
  },
  encode: (value, dictionary) => {
    const leftLength = 2 ** (31 - Math.clz32(value.length - 1))
    let leftAddress
    if (leftLength === 1) leftAddress = encodeNumberToU8a(value[0], minAddressBytes)
    else leftAddress = encodeNumberToU8a(dictionary.upsert(value.slice(0, leftLength), [codec.getCodecType(TREE_NODE)]), minAddressBytes)
    let rightAddress
    if (value.length === leftLength + 1) rightAddress = encodeNumberToU8a(value[value.length - 1], minAddressBytes)
    else rightAddress = encodeNumberToU8a(dictionary.upsert(value.slice(leftLength), [codec.getCodecType(TREE_NODE)]), minAddressBytes)
    const footer = codec.deriveFooter(TREE_NODE_TYPE, [leftAddress.length - minAddressBytes, rightAddress.length - minAddressBytes])
    return combineUint8ArrayLikes([leftAddress, rightAddress, footer])
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + codecVersion.versionArrays[1] + 2 * (minAddressBytes),
  versionArrayCounts: [addressVersions, addressVersions]
})
codec.addCodecType(TREE_NODE_TYPE)

export const OPAQUE_UINT8ARRAY = new CodecType({
  name: 'opaque-uint8array',
  test: value => value instanceof Uint8Array,
  decode: (uint8Array, codecTypeVersion, u8aTurtle) => {
    const valueLengthLength = codecTypeVersion.versionArrays[0] + 1
    return uint8Array.slice(0, -valueLengthLength)
  },
  encode: (value, dictionary) => {
    const encodedValueLength = encodeNumberToU8a(value.length, 1)
    const footer = codec.deriveFooter(OPAQUE_UINT8ARRAY, [encodedValueLength.length - 1])
    return combineUint8ArrayLikes([value, encodedValueLength, footer])
  },
  getWidth: (codecVersion, u8aTurtle, index) => {
    const valueLengthLength = codecVersion.versionArrays[0] + 1
    const encodedValueLength = u8aTurtle.slice(index - valueLengthLength, index)
    const valueLength = decodeNumberFromU8a(encodedValueLength)
    return valueLength + valueLengthLength
  },
  versionArrayCounts: [3],
  isOpaque: true
})
codec.addCodecType(OPAQUE_UINT8ARRAY)

// console.log(codec.codecTypeVersionsByFooter.map((codecVersion, index) => `${index}: { name: "${codecVersion.codecType.name}", versionArrays: ${JSON.stringify(codecVersion.versionArrays)} }`).join('\n'))
