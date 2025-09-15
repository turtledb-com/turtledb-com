import { decodeNumberFromU8a, encodeNumberToU8a } from '../utils.js'
import { combineUint8Arrays } from '../../utils/combineUint8Arrays.js'
import { combineUint8ArrayLikes } from '../../utils/combineUint8ArrayLikes.js'
import { CodecType } from './CodecType.js'
import { Commit } from './Commit.js'
import { CompositeCodec } from './CompositeCodec.js'
import { TreeNode } from './TreeNode.js'
import { logSilly } from '../../utils/logger.js'

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
  if (codec.codecTypeVersionsByFooter[u8aTurtle.getByte()].codecType !== COMMIT) {
    throw new Error('non-commit found where commit is expected')
  }
  const encodedCommit = codec.extractEncodedValue(u8aTurtle)
  const encodedData = u8aTurtle.uint8Array.subarray(0, -encodedCommit.length)
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

export const UNDEFINED = new CodecType({
  name: 'undefined',
  test: value => value === undefined,
  decode: () => undefined,
  encode: () => new Uint8Array([codec.deriveFooter(UNDEFINED, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
})
codec.addCodecType(UNDEFINED)

export const NULL = new CodecType({
  name: 'null',
  test: value => value === null,
  decode: () => null,
  encode: () => new Uint8Array([codec.deriveFooter(NULL, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
})
codec.addCodecType(NULL)

export const FALSE = new CodecType({
  name: 'boolean(false)',
  test: value => value === false,
  decode: () => false,
  encode: () => new Uint8Array([codec.deriveFooter(FALSE, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
})
codec.addCodecType(FALSE)

export const TRUE = new CodecType({
  name: 'boolean(true)',
  test: value => value === true,
  decode: () => true,
  encode: () => new Uint8Array([codec.deriveFooter(TRUE, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
})
codec.addCodecType(TRUE)

export const NUMBER = new CodecType({
  name: 'number',
  test: value => typeof value === 'number',
  decode: (uint8Array) => new Float64Array(new Uint8Array(uint8Array).buffer)[0],
  encode: (value) => combineUint8ArrayLikes([new Float64Array([value]), codec.deriveFooter(NUMBER, [0])]),
  getWidth: () => 8,
  versionArrayCounts: [1]
})
codec.addCodecType(NUMBER)

const STRING = new CodecType({
  name: 'string',
  test: value => typeof value === 'string',
  decode: (uint8Array, _codecVersion, u8aTurtle) => {
    const stringAsU8a = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    return new TextDecoder().decode(stringAsU8a)
  },
  encode: (value, dictionary) => {
    const stringAsU8a = new TextEncoder().encode(value)
    const address = dictionary.upsert(stringAsU8a)
    return encodeAddress(STRING, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
})
codec.addCodecType(STRING)

export const DATE = new CodecType({
  name: 'date',
  test: value => value instanceof Date,
  decode: (uint8Array) => new Date(new Float64Array(new Uint8Array(uint8Array).buffer)[0]),
  encode: (value) => combineUint8ArrayLikes([new Float64Array([value.getTime()]), codec.deriveFooter(DATE, [0])]),
  getWidth: () => 8,
  versionArrayCounts: [1]
})
codec.addCodecType(DATE)

export const BIGINT = new CodecType({
  name: 'bigint',
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
    return encodeAddress(BIGINT, address, minAddressBytes, signVersion)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions, 2]
})
codec.addCodecType(BIGINT)

export const WORD = new CodecType({
  name: 'uint8array(length<=4)',
  test: value => value instanceof Uint8Array && value.length < wordLengthVersions,
  decode: (uint8Array) => uint8Array,
  encode: (value) => combineUint8ArrayLikes([value, codec.deriveFooter(WORD, [value.length])]),
  getWidth: codecVersion => codecVersion.versionArrays[0],
  versionArrayCounts: [wordLengthVersions]
})
codec.addCodecType(WORD)

export const TYPED_ARRAY = new CodecType({
  name: 'typed-array',
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
      address = encodeNumberToU8a(dictionary.upsert([], [EMPTY_ARRAY]), minAddressBytes)
    }
    if (WORD.test(value)) {
      address = dictionary.upsert(value, [WORD])
    } else {
      const wordsLength = Math.ceil(value.length / maxWordLength)
      const words = new Array(wordsLength)
      for (let i = 0; i < wordsLength; ++i) {
        words[i] = dictionary.upsert(value.slice(i * maxWordLength, (i + 1) * maxWordLength), [WORD])
      }
      address = dictionary.upsert(words, [TREE_NODE])
    }
    return encodeAddress(TYPED_ARRAY, address, minAddressBytes, typedArrayVersion)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions, TypedArrays.length]
})
codec.addCodecType(TYPED_ARRAY)

export const EMPTY_ARRAY = new CodecType({
  name: 'array(length==0)',
  test: value => Array.isArray(value) && value.length === 0,
  decode: () => [],
  encode: () => new Uint8Array([codec.deriveFooter(EMPTY_ARRAY, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
})
codec.addCodecType(EMPTY_ARRAY)

export const NONEMPTY_ARRAY = new CodecType({
  name: 'array(length>1)',
  test: value => Array.isArray(value),
  decode: (uint8Array, codecVersion, u8aTurtle, options) => {
    const address = decodeNumberFromU8a(uint8Array)
    if (codecVersion.versionArrays[1]) { // is sparse array
      const arrayAsObject = u8aTurtle.lookup(address, options)
      return Object.assign([], arrayAsObject)
    }
    u8aTurtle = u8aTurtle.getAncestorByAddress(address)
    let refs
    if (u8aTurtle.getCodecType(address) === TREE_NODE) {
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
      address = dictionary.upsert(Object.assign({}, value, { length: value.length }), [OBJECT], options)
      isSparse = 1
    } else {
      if (!options.valuesAsRefs) value = value.map(value => dictionary.upsert(value))
      if (value.length === 1) {
        address = value[0]
      } else {
        address = dictionary.upsert(value, [TREE_NODE])
      }
    }
    return encodeAddress(NONEMPTY_ARRAY, address, minAddressBytes, isSparse)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions, 2]
})
codec.addCodecType(NONEMPTY_ARRAY)

export const SET = new CodecType({
  name: 'set',
  test: value => value instanceof Set,
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return new Set(u8aTurtle.lookup(decodeNumberFromU8a(uint8Array), options))
  },
  encode: (value, dictionary, options) => {
    const objectAsArray = [...value.values()]
    const address = dictionary.upsert(objectAsArray, [EMPTY_ARRAY, NONEMPTY_ARRAY], options)
    return encodeAddress(SET, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
})
codec.addCodecType(SET)

export const MAP = new CodecType({
  name: 'map',
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
    return encodeAddress(MAP, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
})
codec.addCodecType(MAP)

export const COMMIT = new CodecType({
  name: 'commit',
  test: value => value instanceof Commit,
  decode: (uint8Array, codecVersion, u8aTurtle, options) => {
    const address = decodeNumberFromU8a(uint8Array.subarray(0, codecVersion.versionArrays[0] + minAddressBytes))
    const signature = uint8Array.subarray(-64)
    const value = options.valuesAsRefs ? address : u8aTurtle.lookup(address)
    return new Commit(value, signature)
  },
  encode: (value, dictionary, options) => {
    const address = options.valuesAsRefs ? value.document : dictionary.upsert(value.document)
    const u8aAddress = encodeNumberToU8a(address, minAddressBytes)
    const footer = codec.deriveFooter(COMMIT, [u8aAddress.length - minAddressBytes])
    return combineUint8ArrayLikes([u8aAddress, value.signature, footer])
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes + 64,
  versionArrayCounts: [addressVersions],
  isOpaque: true
})
codec.addCodecType(COMMIT)

export const OBJECT = new CodecType({
  name: 'object',
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
    return encodeAddress(OBJECT, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
})
codec.addCodecType(OBJECT)

export const TREE_NODE = new CodecType({
  name: 'tree-node',
  test: value => Array.isArray(value) && value.length > 1,
  decode: (uint8Array, codecVersion) => {
    const [leftAddressLength] = codecVersion.versionArrays
    const leftAddress = decodeNumberFromU8a(uint8Array.subarray(0, leftAddressLength + minAddressBytes))
    const rightAddress = decodeNumberFromU8a(uint8Array.subarray(leftAddressLength + minAddressBytes))
    return new TreeNode(leftAddress, rightAddress)
  },
  encode: (value, dictionary) => {
    const leftLength = 2 ** (31 - Math.clz32(value.length - 1))
    let leftAddress
    if (leftLength === 1) leftAddress = encodeNumberToU8a(value[0], minAddressBytes)
    else leftAddress = encodeNumberToU8a(dictionary.upsert(value.slice(0, leftLength), [TREE_NODE]), minAddressBytes)
    let rightAddress
    if (value.length === leftLength + 1) rightAddress = encodeNumberToU8a(value[value.length - 1], minAddressBytes)
    else rightAddress = encodeNumberToU8a(dictionary.upsert(value.slice(leftLength), [TREE_NODE]), minAddressBytes)
    const footer = codec.deriveFooter(TREE_NODE, [leftAddress.length - minAddressBytes, rightAddress.length - minAddressBytes])
    return combineUint8ArrayLikes([leftAddress, rightAddress, footer])
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + codecVersion.versionArrays[1] + 2 * (minAddressBytes),
  versionArrayCounts: [addressVersions, addressVersions]
})
codec.addCodecType(TREE_NODE)

export const ATOMIC_UINT8ARRAY = new CodecType({
  name: 'atomic-uintarray',
  test: value => value instanceof Uint8Array,
  decode: (uint8Array, codecTypeVersion) => {
    const valueLengthLength = codecTypeVersion.versionArrays[0] + 1
    return uint8Array.subarray(0, -valueLengthLength)
  },
  encode: (value) => {
    const encodedValueLength = encodeNumberToU8a(value.length, 1)
    const footer = codec.deriveFooter(ATOMIC_UINT8ARRAY, [encodedValueLength.length - 1])
    return combineUint8ArrayLikes([value, encodedValueLength, footer])
  },
  getWidth: (codecVersion, u8aTurtle, index) => {
    const valueLengthLength = codecVersion.versionArrays[0] + 1
    const encodedValueLength = u8aTurtle.slice(index - valueLengthLength, index)
    const valueLength = decodeNumberFromU8a(encodedValueLength)
    return valueLength + valueLengthLength
  },
  versionArrayCounts: [3]
})
codec.addCodecType(ATOMIC_UINT8ARRAY)

export const OPAQUE_UINT8ARRAY = new CodecType({
  name: 'opaque-uint8array',
  test: value => value instanceof Uint8Array,
  decode: (uint8Array, codecTypeVersion) => {
    const valueLengthLength = codecTypeVersion.versionArrays[0] + 1
    return uint8Array.subarray(0, -valueLengthLength)
  },
  encode: (value) => {
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

setTimeout(() => logSilly(() => console.log(
  codec.codecTypeVersionsByFooter.map((ctv, i) => `${
      i.toString(2).padStart(8, '0')
    } ${
      ctv.codecType.name
    } ${
      ctv.versionArrays
    }`).join('\n'))
), 0)
