import { combineUint8ArrayLikes, combineUint8Arrays, decodeNumberFromU8a, encodeNumberToU8a } from '../utils.js'
import { Codec, encodeAddress, entriesToObjectRefs, objectRefsToEntries } from './Codec.js'
import { Commit } from './Commit.js'
import { TreeNode } from './TreeNode.js'

const minAddressBytes = 1
const maxAddressBytes = 4
const addressVersions = maxAddressBytes - minAddressBytes + 1
const maxWordLength = 4
const wordLengthVersions = maxWordLength + 1
const TypedArrays = [Uint8Array, Int8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array]

/** @type {Array.<CodecVersion>} */
export const codecVersionByFooter = []

/** @type {Object.<string, Codec>} */
export const codecs = {}

export const UNDEFINED = 'undefined'
codecs[UNDEFINED] = new Codec({
  name: UNDEFINED,
  test: value => value === undefined,
  decode: (_uint8Array, _codecVersion, _dictionary) => undefined,
  encode: (_value, codec, _dictionary) => new Uint8Array([codec.footerFromSubVersions([0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const NULL = 'null'
codecs[NULL] = new Codec({
  name: NULL,
  test: value => value === null,
  decode: (_uint8Array, _codecVersion, _dictionary) => null,
  encode: (_value, codec, _dictionary) => new Uint8Array([codec.footerFromSubVersions([0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const FALSE = 'boolean(false)'
codecs[FALSE] = new Codec({
  name: FALSE,
  test: value => value === false,
  decode: (_uint8Array, _codecVersion, _dictionary) => false,
  encode: (_value, codec, _dictionary) => new Uint8Array([codec.footerFromSubVersions([0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const TRUE = 'boolean(true)'
codecs[TRUE] = new Codec({
  name: TRUE,
  test: value => value === true,
  decode: (_uint8Array, _codecVersion, _dictionary) => true,
  encode: (_value, codec, _dictionary) => new Uint8Array([codec.footerFromSubVersions([0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const NUMBER = 'number'
codecs[NUMBER] = new Codec({
  name: NUMBER,
  test: value => typeof value === 'number',
  decode: (uint8Array, _codecVersion, _dictionary) => new Float64Array(uint8Array.buffer)[0],
  encode: (value, codec, _dictionary) => combineUint8ArrayLikes([new Float64Array([value]), codec.footerFromSubVersions([0])]),
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
  encode: (value, codec, dictionary) => {
    const stringAsU8a = new TextEncoder().encode(value)
    const address = dictionary.upsert(stringAsU8a)
    return encodeAddress(codec, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const DATE = 'date'
codecs[DATE] = new Codec({
  name: DATE,
  test: value => value instanceof Date,
  decode: (uint8Array, _codecVersion, _dictionary) => new Date(new Float64Array(uint8Array.buffer)[0]),
  encode: (value, codec, _dictionary) => combineUint8ArrayLikes([new Float64Array([value.getTime()]), codec.footerFromSubVersions([0])]),
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
codecs[WORD] = new Codec({
  name: WORD,
  test: value => value instanceof Uint8Array && value.length < wordLengthVersions,
  decode: (uint8Array, _codecVersion, _dictionary) => uint8Array,
  encode: (value, codec, _dictionary) => combineUint8ArrayLikes([value, codec.footerFromSubVersions([value.length])]),
  getWidth: codecVersion => codecVersion.subVersions[0],
  subVersionCounts: [wordLengthVersions]
})

export const TYPED_ARRAY = 'typed array'
codecs[TYPED_ARRAY] = new Codec({
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
      address = encodeNumberToU8a(dictionary.upsert([], [codecs[EMPTY_ARRAY]]), minAddressBytes)
    }
    if (codecs[WORD].test(value)) {
      address = dictionary.upsert(value, [codecs[WORD]])
    } else {
      const wordsLength = Math.ceil(value.length / maxWordLength)
      const words = new Array(wordsLength)
      for (let i = 0; i < wordsLength; ++i) {
        words[i] = dictionary.upsert(value.slice(i * maxWordLength, (i + 1) * maxWordLength), [codecs[WORD]])
      }
      address = dictionary.upsert(words, [codecs[TREE_NODE]])
    }
    return encodeAddress(codec, address, minAddressBytes, typedArrayVersion)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions, TypedArrays.length]
})

export const EMPTY_ARRAY = 'array(length==0)'
codecs[EMPTY_ARRAY] = new Codec({
  name: EMPTY_ARRAY,
  test: value => Array.isArray(value) && value.length === 0,
  decode: (_uint8Array, _codecVersion, _dictionary) => [],
  encode: (_value, codec, _dictionary) => new Uint8Array([codec.footerFromSubVersions([0])]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const NONEMPTY_ARRAY = 'array(length>1)'
codecs[NONEMPTY_ARRAY] = new Codec({
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
      address = dictionary.upsert(Object.assign({}, value, { length: value.length }), [codecs[OBJECT]], options)
      isSparse = 1
    } else {
      if (!options.valuesAsRefs) value = value.map(value => dictionary.upsert(value))
      if (value.length === 1) {
        address = value[0]
      } else {
        address = dictionary.upsert(value, [codecs[TREE_NODE]])
      }
    }
    return encodeAddress(codec, address, minAddressBytes, isSparse)
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
  encode: (value, codec, dictionary, options) => {
    const objectAsArray = [...value.values()]
    const address = dictionary.upsert(objectAsArray, undefined, options)
    return encodeAddress(codec, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const MAP = 'map'
codecs[MAP] = new Codec({
  name: MAP,
  test: value => value instanceof Map,
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return new Map(objectRefsToEntries(
      u8aTurtle.lookup(decodeNumberFromU8a(uint8Array), options),
      u8aTurtle,
      options
    ))
  },
  encode: (value, codec, dictionary, options) => {
    const objectAsArray = entriesToObjectRefs(value.entries(), options)
    // const objectAsArray = [...value.keys(), ...value.values()]
    const address = dictionary.upsert(objectAsArray, undefined, options)
    return encodeAddress(codec, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const COMMIT = 'commit'
codecs[COMMIT] = new Codec({
  name: COMMIT,
  test: value => value instanceof Commit,
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    const address = decodeNumberFromU8a(uint8Array.slice(0, -64))
    let value
    if (options?.valuesAsRefs) value = address
    else value = u8aTurtle.lookup(address, options)
    const signature = uint8Array.slice(-64)
    return new Commit(value, signature)
  },
  encode: (value, codec, dictionary, options) => {
    const address = options?.valuesAsRefs ? value.value : encodeNumberToU8a(dictionary.upsert(value.value), minAddressBytes)
    return combineUint8ArrayLikes([address, value.signature, codec.footerFromSubVersions([address.length - minAddressBytes])])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes + 64,
  subVersionCounts: [addressVersions],
  isOpaque: true
})

export const OBJECT = 'object'
codecs[OBJECT] = new Codec({
  name: OBJECT,
  test: value => typeof value === 'object',
  decode: (uint8Array, _codecVersion, u8aTurtle, options) => {
    return Object.fromEntries(objectRefsToEntries(
      u8aTurtle.lookup(decodeNumberFromU8a(uint8Array), options),
      u8aTurtle,
      options
    ))
  },
  encode: (value, codec, dictionary, options) => {
    const objectAsArray = [...Object.keys(value), ...Object.values(value)]
    const address = dictionary.upsert(objectAsArray, undefined, options)
    return encodeAddress(codec, address, minAddressBytes)
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions]
})

export const TREE_NODE = 'tree-node'
codecs[TREE_NODE] = new Codec({
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
    else leftAddress = encodeNumberToU8a(dictionary.upsert(value.slice(0, leftLength), [codecs[TREE_NODE]]), minAddressBytes)
    let rightAddress
    if (value.length === leftLength + 1) rightAddress = encodeNumberToU8a(value[value.length - 1], minAddressBytes)
    else rightAddress = encodeNumberToU8a(dictionary.upsert(value.slice(leftLength), [codecs[TREE_NODE]]), minAddressBytes)
    const footer = codec.footerFromSubVersions([leftAddress.length - minAddressBytes, rightAddress.length - minAddressBytes])
    return combineUint8ArrayLikes([leftAddress, rightAddress, footer])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + codecVersion.subVersions[1] + 2 * (minAddressBytes),
  subVersionCounts: [addressVersions, addressVersions]
})

console.log(codecVersionByFooter.map((codecVersion, index) => `${index}: { name: "${codecVersion.codec.name}", width: ${codecVersion.width}, subVersions: ${JSON.stringify(codecVersion.subVersions)} }`).join('\n'))
