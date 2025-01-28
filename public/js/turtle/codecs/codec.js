import { combineUint8ArrayLikes, combineUint8Arrays, decodeNumberFromU8a, encodeNumberToU8a } from '../utils.js'
import { CodecType } from './CodecType.js'
import { Commit } from './Commit.js'
import { CompositeCodec } from './CompositeCodec.js'
import { TreeNode } from './TreeNode.js'

export const codec = new CompositeCodec()

const minAddressBytes = 1
const maxAddressBytes = 4
const addressVersions = maxAddressBytes - minAddressBytes + 1
const maxWordLength = 4
const wordLengthVersions = maxWordLength + 1
const TypedArrays = [Uint8Array, Int8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array]

/**
 * @param {Array} objectRefs
 * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
 * @param {import('./CodecType.js').CodecOptions} options
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
 * @param {import('../TurtleDictionary.js').TurtleDictionary} dictionary
 * @param {import('./CodecType.js').CodecOptions} options
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
 * @param {import('./CodecType.js').CodecType} codecType
 * @param {number} address
 * @param {number} minAddressBytes
 * @param  {...number} subversions
 * @returns {Uint8Array}
 */
function encodeAddress (codecType, address, minAddressBytes, ...subversions) {
  const u8aAddress = encodeNumberToU8a(address, minAddressBytes)
  const footer = codec.getFooter(codecType, [u8aAddress.length - minAddressBytes, ...subversions])
  return combineUint8ArrayLikes([u8aAddress, footer])
}

export const UNDEFINED = 'undefined'
codec.addCodecType(new CodecType({
  name: UNDEFINED,
  test: value => value === undefined,
  decode: (_uint8Array, _codecVersion, _dictionary) => undefined,
  encode: (_value, codecType, _dictionary) => new Uint8Array([codec.getFooter(codecType, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
}))

export const NULL = 'null'
codec.addCodecType(new CodecType({
  name: NULL,
  test: value => value === null,
  decode: (_uint8Array, _codecVersion, _dictionary) => null,
  encode: (_value, codecType, _dictionary) => new Uint8Array([codec.getFooter(codecType, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
}))

export const FALSE = 'boolean(false)'
codec.addCodecType(new CodecType({
  name: FALSE,
  test: value => value === false,
  decode: (_uint8Array, _codecVersion, _dictionary) => false,
  encode: (_value, codecType, _dictionary) => new Uint8Array([codec.getFooter(codecType, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
}))

export const TRUE = 'boolean(true)'
codec.addCodecType(new CodecType({
  name: TRUE,
  test: value => value === true,
  decode: (_uint8Array, _codecVersion, _dictionary) => true,
  encode: (_value, codecType, _dictionary) => new Uint8Array([codec.getFooter(codecType, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
}))

export const NUMBER = 'number'
codec.addCodecType(new CodecType({
  name: NUMBER,
  test: value => typeof value === 'number',
  decode: (uint8Array, _codecVersion, _dictionary) => new Float64Array(uint8Array.buffer)[0],
  encode: (value, codecType, _dictionary) => combineUint8ArrayLikes([new Float64Array([value]), codec.getFooter(codecType, [0])]),
  getWidth: () => 8,
  versionArrayCounts: [1]
}))

export const STRING = 'string'
codec.addCodecType(new CodecType({
  name: STRING,
  test: value => typeof value === 'string',
  decode: (uint8Array, _codecVersion, u8aTurtle) => {
    const stringAsU8a = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    return new TextDecoder().decode(stringAsU8a)
  },
  encode: (value, codecType, dictionary) => {
    const stringAsU8a = new TextEncoder().encode(value)
    const address = dictionary.upsert(stringAsU8a)
    return encodeAddress(codecType, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
}))

export const DATE = 'date'
codec.addCodecType(new CodecType({
  name: DATE,
  test: value => value instanceof Date,
  decode: (uint8Array, _codecVersion, _dictionary) => new Date(new Float64Array(uint8Array.buffer)[0]),
  encode: (value, codecType, _dictionary) => combineUint8ArrayLikes([new Float64Array([value.getTime()]), codec.getFooter(codecType, [0])]),
  getWidth: () => 8,
  versionArrayCounts: [1]
}))

export const BIGINT = 'bigint'
codec.addCodecType(new CodecType({
  name: BIGINT,
  test: value => typeof value === 'bigint',
  decode: (uint8Array, codecVersion, u8aTurtle) => {
    const sign = codecVersion.versionArrays[1] ? -1n : 1n
    const hex = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    return sign * BigInt(`0x${[...hex].map(byte => `0${byte.toString(16)}`.slice(-2)).join('')}`)
  },
  encode: (value, codecType, dictionary) => {
    const signVersion = value < 0n ? 1 : 0
    const sign = value < 0n ? -1n : 1n
    let bigintHex = (sign * value).toString(16)
    if (bigintHex.length % 2) bigintHex = `0${bigintHex}`
    const uint8Array = new Uint8Array(bigintHex.match(/.{1,2}/g).map(hex => parseInt(hex, 16)))
    const address = dictionary.upsert(uint8Array)
    return encodeAddress(codecType, address, minAddressBytes, signVersion)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions, 2]
}))

export const WORD = 'word (<= 4-bytes)'
codec.addCodecType(new CodecType({
  name: WORD,
  test: value => value instanceof Uint8Array && value.length < wordLengthVersions,
  decode: (uint8Array, _codecVersion, _dictionary) => uint8Array,
  encode: (value, codecType, _dictionary) => combineUint8ArrayLikes([value, codec.getFooter(codecType, [value.length])]),
  getWidth: codecVersion => codecVersion.versionArrays[0],
  versionArrayCounts: [wordLengthVersions]
}))

export const TYPED_ARRAY = 'typed array'
codec.addCodecType(new CodecType({
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
  encode: (value, codecType, dictionary) => {
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
    return encodeAddress(codecType, address, minAddressBytes, typedArrayVersion)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions, TypedArrays.length]
}))

export const EMPTY_ARRAY = 'array(length==0)'
codec.addCodecType(new CodecType({
  name: EMPTY_ARRAY,
  test: value => Array.isArray(value) && value.length === 0,
  decode: (_uint8Array, _codecVersion, _dictionary) => [],
  encode: (_value, codecType, _dictionary) => new Uint8Array([codec.getFooter(codecType, [0])]),
  getWidth: () => 0,
  versionArrayCounts: [1]
}))

export const NONEMPTY_ARRAY = 'array(length>1)'
codec.addCodecType(new CodecType({
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
  encode: (value, codecType, dictionary, options) => {
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
    return encodeAddress(codecType, address, minAddressBytes, isSparse)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions, 2]
}))

export const SET = 'set'
codec.addCodecType(new CodecType({
  name: SET,
  test: value => value instanceof Set,
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return new Set(u8aTurtle.lookup(decodeNumberFromU8a(uint8Array), options))
  },
  encode: (value, codecType, dictionary, options) => {
    const objectAsArray = [...value.values()]
    const address = dictionary.upsert(objectAsArray, [codec.getCodecType(EMPTY_ARRAY), codec.getCodecType(NONEMPTY_ARRAY)], options)
    return encodeAddress(codecType, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
}))

export const MAP = 'map'
codec.addCodecType(new CodecType({
  name: MAP,
  test: value => value instanceof Map,
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return new Map(objectRefsToEntries(
      u8aTurtle.lookup(decodeNumberFromU8a(uint8Array)),
      u8aTurtle,
      options
    ))
  },
  encode: (value, codecType, dictionary, options) => {
    const objectRefs = entriesToObjectRefs(value.entries(), dictionary, options)
    const address = dictionary.upsert(objectRefs)
    return encodeAddress(codecType, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
}))

export const COMMIT = 'commit'
codec.addCodecType(new CodecType({
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
  encode: (value, codecType, dictionary, options) => {
    const address = options.valuesAsRefs ? value.value : dictionary.upsert(value.value)
    if (value.signature) {
      const u8aAddress = encodeNumberToU8a(address, minAddressBytes)
      return combineUint8ArrayLikes([u8aAddress, value.signature, codec.getFooter(codecType, [u8aAddress.length - minAddressBytes, 1])])
    }
    return encodeAddress(codecType, address, minAddressBytes, 0)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes + codecVersion.versionArrays[1] * 64,
  versionArrayCounts: [addressVersions, 2],
  isOpaque: true
}))

export const OBJECT = 'object'
codec.addCodecType(new CodecType({
  name: OBJECT,
  test: value => typeof value === 'object',
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return Object.fromEntries(objectRefsToEntries(
      u8aTurtle.lookup(decodeNumberFromU8a(uint8Array)),
      u8aTurtle,
      options
    ))
  },
  encode: (value, codecType, dictionary, options) => {
    const objectRefs = entriesToObjectRefs(Object.entries(value), dictionary, options)
    const address = dictionary.upsert(objectRefs)
    return encodeAddress(codecType, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + minAddressBytes,
  versionArrayCounts: [addressVersions]
}))

export const TREE_NODE = 'tree-node'
codec.addCodecType(new CodecType({
  name: TREE_NODE,
  test: value => Array.isArray(value) && value.length > 1,
  decode: (uint8Array, codecVersion) => {
    const [leftAddressLength] = codecVersion.versionArrays
    const leftAddress = decodeNumberFromU8a(uint8Array.slice(0, leftAddressLength + minAddressBytes))
    const rightAddress = decodeNumberFromU8a(uint8Array.slice(leftAddressLength + minAddressBytes))
    return new TreeNode(leftAddress, rightAddress)
  },
  encode: (value, codecType, dictionary) => {
    const leftLength = 2 ** (31 - Math.clz32(value.length - 1))
    let leftAddress
    if (leftLength === 1) leftAddress = encodeNumberToU8a(value[0], minAddressBytes)
    else leftAddress = encodeNumberToU8a(dictionary.upsert(value.slice(0, leftLength), [codec.getCodecType(TREE_NODE)]), minAddressBytes)
    let rightAddress
    if (value.length === leftLength + 1) rightAddress = encodeNumberToU8a(value[value.length - 1], minAddressBytes)
    else rightAddress = encodeNumberToU8a(dictionary.upsert(value.slice(leftLength), [codec.getCodecType(TREE_NODE)]), minAddressBytes)
    const footer = codec.getFooter(codecType, [leftAddress.length - minAddressBytes, rightAddress.length - minAddressBytes])
    return combineUint8ArrayLikes([leftAddress, rightAddress, footer])
  },
  getWidth: codecVersion => codecVersion.versionArrays[0] + codecVersion.versionArrays[1] + 2 * (minAddressBytes),
  versionArrayCounts: [addressVersions, addressVersions]
}))

export const OPAQUE_UINT8ARRAY = 'opaque-uint8array'
codec.addCodecType(new CodecType({
  name: OPAQUE_UINT8ARRAY,
  test: value => value instanceof Uint8Array,
  decode: (uint8Array, codecTypeVersion, u8aTurtle) => {
    const valueLengthLength = codecTypeVersion.versionArrays[0] + 1
    return uint8Array.slice(0, -valueLengthLength)
  },
  encode: (value, codecType, dictionary) => {
    const encodedValueLength = encodeNumberToU8a(value.length, 1)
    const footer = codec.getFooter(codecType, [encodedValueLength.length - 1])
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
}))

console.log(codec.codecTypeVersionsByFooter.map((codecVersion, index) => `${index}: { name: "${codecVersion.codecType.name}", versionArrays: ${JSON.stringify(codecVersion.versionArrays)} }`).join('\n'))
