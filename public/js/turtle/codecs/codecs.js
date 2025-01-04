import { combineUint8ArrayLikes, combineUint8Arrays, decodeNumberFromU8a, encodeNumberToU8a, toCombinedVersion, toVersionCount } from '../utils.js'
import { CodecType, DEREFERENCE } from './CodecType.js'
import { CodecTypeVersion } from './CodecTypeVersion.js'
import { Commit } from './Commit.js'
import { TreeNode } from './TreeNode.js'

const minAddressBytes = 1
const maxAddressBytes = 4
const addressVersions = maxAddressBytes - minAddressBytes + 1
const maxWordLength = 4
const wordLengthVersions = maxWordLength + 1
const TypedArrays = [Uint8Array, Int8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array]

/** @type {Array.<CodecTypeVersion>} */
export const codecVersionByFooter = []

/** @type {Object.<string, CodecType>} */
export const codecsByName = {}

/** @type {Map.<CodecType, Array} */
const footerByCodecCombinedVersions = new Map()
function getFooter (codec, subVersions) {
  return footerByCodecCombinedVersions.get(codec)[toCombinedVersion(subVersions, codec.subVersionCounts)]
}

/**
 * @param {Array} objectRefs
 * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
 * @param {CodecOptions} options
 * @returns {Array.<[any, any]>}
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
 * @returns {Array}
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
 * @param {CodecType} codec
 * @param {number} address
 * @param {number} minAddressBytes
 * @param  {...number} subversions
 * @returns {Uint8Array}
 */
export function encodeAddress (codec, address, minAddressBytes, ...subversions) {
  const u8aAddress = encodeNumberToU8a(address, minAddressBytes)
  const footer = getFooter(codec, [u8aAddress.length - minAddressBytes, ...subversions])
  return combineUint8ArrayLikes([u8aAddress, footer])
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
function addCodecType (properties) {
  const codec = new CodecType(properties)
  const versionCount = toVersionCount(properties.subVersionCounts)
  const footerByVersion = new Array(versionCount)
  for (let combinedVersion = 0; combinedVersion < versionCount; ++combinedVersion) {
    const footer = codecVersionByFooter.length
    footerByVersion[combinedVersion] = footer
    codecVersionByFooter.push(new CodecTypeVersion(codec, combinedVersion))
  }
  footerByCodecCombinedVersions.set(codec, footerByVersion)
  codecsByName[properties.name] = codec
}

export const UNDEFINED = 'undefined'
addCodecType({
  name: UNDEFINED,
  test: value => value === undefined,
  decode: (_uint8Array, _codecVersion, _dictionary) => undefined,
  encode: (_value, codec, _dictionary) => new Uint8Array([getFooter(codec, [0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const NULL = 'null'
addCodecType({
  name: NULL,
  test: value => value === null,
  decode: (_uint8Array, _codecVersion, _dictionary) => null,
  encode: (_value, codec, _dictionary) => new Uint8Array([getFooter(codec, [0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const FALSE = 'boolean(false)'
addCodecType({
  name: FALSE,
  test: value => value === false,
  decode: (_uint8Array, _codecVersion, _dictionary) => false,
  encode: (_value, codec, _dictionary) => new Uint8Array([getFooter(codec, [0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const TRUE = 'boolean(true)'
addCodecType({
  name: TRUE,
  test: value => value === true,
  decode: (_uint8Array, _codecVersion, _dictionary) => true,
  encode: (_value, codec, _dictionary) => new Uint8Array([getFooter(codec, [0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const NUMBER = 'number'
addCodecType({
  name: NUMBER,
  test: value => typeof value === 'number',
  decode: (uint8Array, _codecVersion, _dictionary) => new Float64Array(uint8Array.buffer)[0],
  encode: (value, codec, _dictionary) => combineUint8ArrayLikes([new Float64Array([value]), getFooter(codec, [0])]),
  getWidth: () => 8,
  subVersionCounts: [1]
})

export const STRING = 'string'
addCodecType({
  name: STRING,
  test: value => typeof value === 'string',
  decode: (uint8Array, _codecVersion, u8aTurtle) => {
    const stringAsU8a = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    return new TextDecoder().decode(stringAsU8a)
  },
  encode: (value, codec, dictionary) => {
    const stringAsU8a = new TextEncoder().encode(value)
    const address = dictionary.upsert(stringAsU8a)
    return encodeAddress(codec, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const DATE = 'date'
addCodecType({
  name: DATE,
  test: value => value instanceof Date,
  decode: (uint8Array, _codecVersion, _dictionary) => new Date(new Float64Array(uint8Array.buffer)[0]),
  encode: (value, codec, _dictionary) => combineUint8ArrayLikes([new Float64Array([value.getTime()]), getFooter(codec, [0])]),
  getWidth: () => 8,
  subVersionCounts: [1]
})

export const BIGINT = 'bigint'
addCodecType({
  name: BIGINT,
  test: value => typeof value === 'bigint',
  decode: (uint8Array, codecVersion, u8aTurtle) => {
    const sign = codecVersion.subVersions[1] ? -1n : 1n
    const hex = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    return sign * BigInt(`0x${[...hex].map(byte => `0${byte.toString(16)}`.slice(-2)).join('')}`)
  },
  encode: (value, codec, dictionary) => {
    const signVersion = value < 0n ? 1 : 0
    const sign = value < 0n ? -1n : 1n
    let bigintHex = (sign * value).toString(16)
    if (bigintHex.length % 2) bigintHex = `0${bigintHex}`
    const uint8Array = new Uint8Array(bigintHex.match(/.{1,2}/g).map(hex => parseInt(hex, 16)))
    const address = dictionary.upsert(uint8Array)
    return encodeAddress(codec, address, minAddressBytes, signVersion)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions, 2]
})

export const WORD = 'word (<= 4-bytes)'
addCodecType({
  name: WORD,
  test: value => value instanceof Uint8Array && value.length < wordLengthVersions,
  decode: (uint8Array, _codecVersion, _dictionary) => uint8Array,
  encode: (value, codec, _dictionary) => combineUint8ArrayLikes([value, getFooter(codec, [value.length])]),
  getWidth: codecVersion => codecVersion.subVersions[0],
  subVersionCounts: [wordLengthVersions]
})

export const TYPED_ARRAY = 'typed array'
addCodecType({
  name: TYPED_ARRAY,
  test: value => (value instanceof Object.getPrototypeOf(Uint8Array)),
  decode: (uint8Array, codecVersion, u8aTurtle) => {
    let value = u8aTurtle.lookup(decodeNumberFromU8a(uint8Array))
    if (value instanceof TreeNode) {
      value = combineUint8Arrays([...value.inOrder(u8aTurtle)].map(address => u8aTurtle.lookup(address)))
    } else if (value.length === 0) {
      value = new Uint8Array()
    }
    const TypedArray = TypedArrays[codecVersion.subVersions[1]]
    return new TypedArray(value.buffer)
  },
  encode: (value, codec, dictionary) => {
    const typedArrayVersion = TypedArrays.findIndex(TypedArray => value instanceof TypedArray)
    if (!(value instanceof Uint8Array)) {
      value = new Uint8Array(value.buffer)
    }
    let address
    if (value.length === 0) {
      address = encodeNumberToU8a(dictionary.upsert([], [codecsByName[EMPTY_ARRAY]]), minAddressBytes)
    }
    if (codecsByName[WORD].test(value)) {
      address = dictionary.upsert(value, [codecsByName[WORD]])
    } else {
      const wordsLength = Math.ceil(value.length / maxWordLength)
      const words = new Array(wordsLength)
      for (let i = 0; i < wordsLength; ++i) {
        words[i] = dictionary.upsert(value.slice(i * maxWordLength, (i + 1) * maxWordLength), [codecsByName[WORD]])
      }
      address = dictionary.upsert(words, [codecsByName[TREE_NODE]])
    }
    return encodeAddress(codec, address, minAddressBytes, typedArrayVersion)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions, TypedArrays.length]
})

export const EMPTY_ARRAY = 'array(length==0)'
addCodecType({
  name: EMPTY_ARRAY,
  test: value => Array.isArray(value) && value.length === 0,
  decode: (_uint8Array, _codecVersion, _dictionary) => [],
  encode: (_value, codec, _dictionary) => new Uint8Array([getFooter(codec, [0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const NONEMPTY_ARRAY = 'array(length>1)'
addCodecType({
  name: NONEMPTY_ARRAY,
  test: value => Array.isArray(value),
  decode: (uint8Array, codecVersion, u8aTurtle, options) => {
    const address = decodeNumberFromU8a(uint8Array)
    if (codecVersion.subVersions[1]) { // is sparse array
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
  encode: (value, codec, dictionary, options) => {
    let address
    let isSparse = 0
    if (JSON.stringify(Object.keys(value)) !== JSON.stringify(Object.keys([...value]))) { // is sparse array
      address = dictionary.upsert(Object.assign({}, value, { length: value.length }), [codecsByName[OBJECT]], options)
      isSparse = 1
    } else {
      if (!options.valuesAsRefs) value = value.map(value => dictionary.upsert(value))
      if (value.length === 1) {
        address = value[0]
      } else {
        address = dictionary.upsert(value, [codecsByName[TREE_NODE]])
      }
    }
    return encodeAddress(codec, address, minAddressBytes, isSparse)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions, 2]
})

export const SET = 'set'
addCodecType({
  name: SET,
  test: value => value instanceof Set,
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return new Set(u8aTurtle.lookup(decodeNumberFromU8a(uint8Array), options))
  },
  encode: (value, codec, dictionary, options) => {
    const objectAsArray = [...value.values()]
    const address = dictionary.upsert(objectAsArray, [codecsByName[EMPTY_ARRAY], codecsByName[NONEMPTY_ARRAY]], options)
    return encodeAddress(codec, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const MAP = 'map'
addCodecType({
  name: MAP,
  test: value => value instanceof Map,
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return new Map(objectRefsToEntries(
      u8aTurtle.lookup(decodeNumberFromU8a(uint8Array)),
      u8aTurtle,
      options
    ))
  },
  encode: (value, codec, dictionary, options) => {
    const objectRefs = entriesToObjectRefs(value.entries(), dictionary, options)
    const address = dictionary.upsert(objectRefs)
    return encodeAddress(codec, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const COMMIT = 'commit'
addCodecType({
  name: COMMIT,
  test: value => value instanceof Commit,
  decode: (uint8Array, codecVersion, u8aTurtle, options) => {
    const address = decodeNumberFromU8a(uint8Array.slice(0, codecVersion.subVersions[0] + minAddressBytes))
    let signature
    if (codecVersion.subVersions[1]) {
      signature = uint8Array.slice(-64)
    }
    const value = options.valuesAsRefs ? address : u8aTurtle.lookup(address)
    return new Commit(value, signature)
  },
  encode: (value, codec, dictionary, options) => {
    const address = options.valuesAsRefs ? value.value : dictionary.upsert(value.value)
    if (value.signature) {
      const u8aAddress = encodeNumberToU8a(address, minAddressBytes)
      return combineUint8ArrayLikes([u8aAddress, value.signature, getFooter(codec, [u8aAddress.length - minAddressBytes, 1])])
    }
    return encodeAddress(codec, address, minAddressBytes, 0)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes + codecVersion.subVersions[1] * 64,
  subVersionCounts: [addressVersions, 2],
  isOpaque: true
})

export const OBJECT = 'object'
addCodecType({
  name: OBJECT,
  test: value => typeof value === 'object',
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return Object.fromEntries(objectRefsToEntries(
      u8aTurtle.lookup(decodeNumberFromU8a(uint8Array)),
      u8aTurtle,
      options
    ))
  },
  encode: (value, codec, dictionary, options) => {
    const objectRefs = entriesToObjectRefs(Object.entries(value), dictionary, options)
    const address = dictionary.upsert(objectRefs)
    return encodeAddress(codec, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const TREE_NODE = 'tree-node'
addCodecType({
  name: TREE_NODE,
  test: value => Array.isArray(value) && value.length > 1,
  decode: (uint8Array, codecVersion) => {
    const [leftAddressLength] = codecVersion.subVersions
    const leftAddress = decodeNumberFromU8a(uint8Array.slice(0, leftAddressLength + minAddressBytes))
    const rightAddress = decodeNumberFromU8a(uint8Array.slice(leftAddressLength + minAddressBytes))
    return new TreeNode(leftAddress, rightAddress)
  },
  encode: (value, codec, dictionary) => {
    const leftLength = 2 ** (31 - Math.clz32(value.length - 1))
    let leftAddress
    if (leftLength === 1) leftAddress = encodeNumberToU8a(value[0], minAddressBytes)
    else leftAddress = encodeNumberToU8a(dictionary.upsert(value.slice(0, leftLength), [codecsByName[TREE_NODE]]), minAddressBytes)
    let rightAddress
    if (value.length === leftLength + 1) rightAddress = encodeNumberToU8a(value[value.length - 1], minAddressBytes)
    else rightAddress = encodeNumberToU8a(dictionary.upsert(value.slice(leftLength), [codecsByName[TREE_NODE]]), minAddressBytes)
    const footer = getFooter(codec, [leftAddress.length - minAddressBytes, rightAddress.length - minAddressBytes])
    return combineUint8ArrayLikes([leftAddress, rightAddress, footer])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + codecVersion.subVersions[1] + 2 * (minAddressBytes),
  subVersionCounts: [addressVersions, addressVersions]
})

export const allCodecsArray = Object.values(codecsByName)

export function encodeValue (value, codecsArray = allCodecsArray, dictionary, options = DEREFERENCE) {
  const codec = codecsArray.find(codec => codec.test(value)) // first match wins
  if (!codec) {
    console.error('no match', value)
    throw new Error('no encoder for value')
  }
  const uint8Array = codec.encode(value, codec, dictionary, options)
  return { uint8Array, codec }
}

console.log(codecVersionByFooter.map((codecVersion, index) => `${index}: { name: "${codecVersion.codecType.name}", width: ${codecVersion.width}, subVersions: ${JSON.stringify(codecVersion.subVersions)} }`).join('\n'))
