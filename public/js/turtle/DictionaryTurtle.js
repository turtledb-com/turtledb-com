import { U8aTurtleBranch } from './U8aTurtleBranch.js'
import { combineUint8ArrayLikes, combineUint8Arrays, decodeNumberFromU8a, encodeNumberToU8a, toCombinedVersion, toSubVersions, toVersionCount, ValueByUint8Array } from './utils.js'

export class DictionaryTurtle extends U8aTurtleBranch {
  #valueByUint8Array = new ValueByUint8Array()
  constructor (name, recaller, u8aTurtle) {
    super(name, recaller, u8aTurtle)
    this.lexicograph()
  }

  append (uint8Array) {
    const start = this.length
    super.append(uint8Array)
    this.lexicograph(start)
  }

  lexicograph (start = 0, end = this.length - 1) {
    let address = end
    let u8aTurtle = this.u8aTurtle
    while (u8aTurtle) {
      while (address > start && address > u8aTurtle.offset) {
        const footer = this.getByte(address)
        if (!codecVersionByFooter[footer]) {
          console.error({ address, footer })
          throw new Error('no decoder for footer')
        }
        const width = codecVersionByFooter[footer].width
        const uint8Array = this.slice(address - width, address)
        if (this.#valueByUint8Array.get(uint8Array) !== undefined) {
          console.error({ address, footer, uint8Array, width })
          throw new Error('uint8Array already stored')
        }
        this.#valueByUint8Array.set(uint8Array, address)
        address -= width
      }
      u8aTurtle = u8aTurtle.parent
    }
  }

  upsert (value, codecsArray = Object.values(codecs)) {
    const codec = codecsArray.find(codec => codec.test(value)) // first match wins
    if (!codec) {
      console.error('no match', value)
      throw new Error('no encoder for value')
    }
    const uint8Array = codec.encode(value, codec, this)
    let address = this.#valueByUint8Array.get(uint8Array)
    if (address === undefined) {
      super.append(uint8Array)
      address = this.length - 1
      this.#valueByUint8Array.set(uint8Array, address)
    }
    return address
  }

  lookup (address) {
    const footer = this.getByte(address)
    const codecVersion = codecVersionByFooter[footer]
    const width = codecVersion.width
    const uint8Array = this.slice(address - width, address)
    const value = codecVersion.codec.decode(uint8Array, codecVersion, this)
    return value
  }
}

class CodecVersion {
  /**
   *
   * @param {Codec} codec
   * @param {number} combinedVersion
   */
  constructor (codec, combinedVersion) {
    this.codec = codec
    this.combinedVersion = combinedVersion
    this.subVersions = toSubVersions(combinedVersion, codec.subVersionCounts)
    this.width = codec.getWidth(this)
  }
}

/** @type {Array.<CodecVersion>} */
export const codecVersionByFooter = []

class Codec {
  /**
   * @param {{
   *  name: string,
   *  test: (value:any) => boolean,
   *  decode: (uint8Array: Uint8Array, codecVersion: CodecVersion, dictionaryTurtle: DictionaryTurtle) => any,
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
}

const minAddressBytes = 2
const maxAddressBytes = 4
const addressVersions = maxAddressBytes - minAddressBytes + 1
/** @type {Object.<string, Codec>} */
const codecs = {}

export const UNDEFINED = 'undefined'
codecs[UNDEFINED] = new Codec({
  name: UNDEFINED,
  test: value => value === undefined,
  decode: (_uint8Array, _codecVersion, _dictionaryTurtle) => undefined,
  encode: (_value, codec) => new Uint8Array([codec.footerByVersion[0]]),
  getWidth: () => 0,
  subVersionCounts: [1]
})
export const NULL = 'null'
codecs[NULL] = new Codec({
  name: NULL,
  test: value => value === null,
  decode: (_uint8Array, _codecVersion, _dictionaryTurtle) => null,
  encode: (_value, codec, _dictionaryTurtle) => new Uint8Array([codec.footerByVersion[0]]),
  getWidth: () => 0,
  subVersionCounts: [1]
})
export const FALSE = 'boolean(false)'
codecs[FALSE] = new Codec({
  name: FALSE,
  test: value => value === false,
  decode: (_uint8Array, _codecVersion, _dictionaryTurtle) => false,
  encode: (_value, codec, _dictionaryTurtle) => new Uint8Array([codec.footerByVersion[0]]),
  getWidth: () => 0,
  subVersionCounts: [1]
})
export const TRUE = 'boolean(true)'
codecs[TRUE] = new Codec({
  name: TRUE,
  test: value => value === true,
  decode: (_uint8Array, _codecVersion, _dictionaryTurtle) => true,
  encode: (_value, codec, _dictionaryTurtle) => new Uint8Array([codec.footerByVersion[0]]),
  getWidth: () => 0,
  subVersionCounts: [1]
})
export const NUMBER = 'number'
codecs[NUMBER] = new Codec({
  name: NUMBER,
  test: value => typeof value === 'number',
  decode: (uint8Array, _codecVersion, _dictionaryTurtle) => new Float64Array(uint8Array.buffer)[0],
  encode: (value, codec, _dictionaryTurtle) => combineUint8ArrayLikes([new Float64Array([value]), codec.footerByVersion[0]]),
  getWidth: () => 8,
  subVersionCounts: [1]
})

export const EMPTY_ARRAY = 'array(length==0)'
codecs[EMPTY_ARRAY] = new Codec({
  name: EMPTY_ARRAY,
  test: value => Array.isArray(value) && value.length === 0,
  decode: (_uint8Array, _codecVersion, _dictionaryTurtle) => [],
  encode: (_value, codec, _dictionaryTurtle) => new Uint8Array([codec.footerByVersion[0]]),
  getWidth: () => 0,
  subVersionCounts: [1]
})

export const ARRAY = 'array(length>1)'
codecs[ARRAY] = new Codec({
  name: ARRAY,
  test: value => Array.isArray(value),
  decode: (uint8Array, _codecVersion, dictionaryTurtle) => {
    const treeNode = dictionaryTurtle.lookup(decodeNumberFromU8a(uint8Array))
    if (treeNode instanceof TreeNode) return [...treeNode.inOrder()]
    return [treeNode]
  },
  encode: (value, codec, dictionaryTurtle) => {
    let address
    if (value.length === 1) address = encodeNumberToU8a(dictionaryTurtle.upsert(value[0]), minAddressBytes)
    else address = encodeNumberToU8a(dictionaryTurtle.upsert(value, [codecs[TREE_NODE]]), minAddressBytes)
    return combineUint8ArrayLikes([address, codec.footerByVersion[address.length - minAddressBytes]])
  },
  getWidth: codecVersion => codecVersion.combinedVersion + minAddressBytes,
  subVersionCounts: [addressVersions]
})

class TreeNode {
  constructor (left, right) {
    this.left = left
    this.right = right
  }

  * inOrder () {
    if (this.left instanceof TreeNode) yield * this.left.inOrder()
    else yield this.left
    if (this.right instanceof TreeNode) yield * this.right.inOrder()
    else yield this.right
  }
}
export const TREE_NODE = 'tree-node'
codecs[TREE_NODE] = new Codec({
  name: TREE_NODE,
  test: value => Array.isArray(value) && value.length > 1,
  decode: (uint8Array, codecVersion, dictionaryTurtle) => {
    const [leftAddressLength] = codecVersion.subVersions
    const leftAddress = decodeNumberFromU8a(uint8Array.slice(0, leftAddressLength + 2))
    const rightAddress = decodeNumberFromU8a(uint8Array.slice(leftAddressLength + 2))
    return new TreeNode(dictionaryTurtle.lookup(leftAddress), dictionaryTurtle.lookup(rightAddress))
  },
  encode: (value, codec, dictionaryTurtle) => {
    const leftLength = 2 ** (31 - Math.clz32(value.length - 1))
    let leftAddress
    if (leftLength === 1) leftAddress = encodeNumberToU8a(dictionaryTurtle.upsert(value[0]), minAddressBytes)
    else leftAddress = encodeNumberToU8a(dictionaryTurtle.upsert(value.slice(0, leftLength), [codecs[TREE_NODE]]), minAddressBytes)
    let rightAddress
    if (value.length === leftLength + 1) rightAddress = encodeNumberToU8a(dictionaryTurtle.upsert(value[value.length - 1]), minAddressBytes)
    else rightAddress = encodeNumberToU8a(dictionaryTurtle.upsert(value.slice(leftLength), [codecs[TREE_NODE]]), minAddressBytes)
    const footer = codec.footerByVersion[toCombinedVersion([leftAddress.length - minAddressBytes, rightAddress.length - minAddressBytes], [addressVersions, addressVersions])]
    return combineUint8ArrayLikes([leftAddress, rightAddress, footer])
  },
  getWidth: codecVersion => codecVersion.combinedVersion + 2 * (minAddressBytes),
  subVersionCounts: [addressVersions, addressVersions]
})

export const maxWordLength = 4
export const wordLengthVersions = maxWordLength + 1
export const WORD = 'word (<= 4-bytes)'
codecs[WORD] = new Codec({
  name: WORD,
  test: value => value instanceof Uint8Array && value.length < wordLengthVersions,
  decode: (uint8Array, _codecVersion, _dictionaryTurtle) => uint8Array,
  encode: (value, codec, _dictionaryTurtle) => combineUint8ArrayLikes([value, codec.footerByVersion[value.length]]),
  getWidth: codecVersion => codecVersion.combinedVersion,
  subVersionCounts: [wordLengthVersions]
})

const TypedArrays = [Uint8Array, Int8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array]
export const TYPED_ARRAY = 'typed array'
codecs[TYPED_ARRAY] = new Codec({
  name: TYPED_ARRAY,
  test: value => (value instanceof Object.getPrototypeOf(Uint8Array)),
  decode: (uint8Array, codecVersion, dictionaryTurtle) => {
    let value = dictionaryTurtle.lookup(decodeNumberFromU8a(uint8Array))
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
    const combinedVersion = toCombinedVersion([address.length - minAddressBytes, typedArrayVersion], [addressVersions, TypedArrays.length])
    return combineUint8ArrayLikes([address, codec.footerByVersion[combinedVersion]])
  },
  getWidth: codecVersion => codecVersion.subVersions[0] + minAddressBytes,
  subVersionCounts: [addressVersions, TypedArrays.length]
})

console.log(codecVersionByFooter.map((codecVersion, index) => `${index}: { name: "${codecVersion.codec.name}", width: ${codecVersion.width}, subVersions: ${JSON.stringify(codecVersion.subVersions)} }`).join('\n'))
