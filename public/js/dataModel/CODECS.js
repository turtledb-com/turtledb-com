import { collapseUint8Arrays } from './Uint8ArrayLayer.js'

const encodeVariable = (address, minimumLength = 2) => {
  if (typeof address !== 'number') throw new Error('addresses are numbers')
  if (Number.isNaN(address)) throw new Error('addresses are not NaN')
  const asBytes = [...new Uint8Array(new BigUint64Array([BigInt(address)]).buffer)]
  while (asBytes.length > minimumLength && !asBytes[asBytes.length - 1]) asBytes.pop()
  return new Uint8Array(asBytes)
}

const decodeVariable = uint8Array => {
  const asBytes = new Uint8Array(8)
  asBytes.set(uint8Array)
  return Number(new BigUint64Array(asBytes.buffer)[0])
}

const LITERAL = {
  BITS: Symbol('value encoded into a few footer bits'),
  VARIABLE: Symbol('value encoded into a few bytes before the footer'),
  LENGTH_TERMINATED: Symbol('"length" is encoded into a few bytes, value is the "length"-long array of bytes before that')
}

class Block {
  constructor (bitWidth, bitOffset = 0, literal = LITERAL.VARIABLE) {
    this.bitWidth = bitWidth
    this.bitOffset = bitOffset
    this.literal = literal
  }

  encodeBlock (value) {
    if (this.literal === LITERAL.BITS) {
      return {
        value: new Uint8Array(),
        bits: value - this.bitOffset
      }
    }
    if (this.literal === LITERAL.VARIABLE) {
      return {
        value,
        bits: value.length - this.bitOffset
      }
    }
    if (this.literal === LITERAL.LENGTH_TERMINATED) {
      const encodedLength = encodeVariable(value.length, 1)
      return {
        value: collapseUint8Arrays(value, encodedLength),
        bits: encodedLength.length - this.bitOffset
      }
    }
  }

  decodeBlock (uint8ArrayLayer, address, footer, bitShift) {
    const tinyInt = this.bitOffset + ((footer >>> (8 - bitShift)) & (0b11111111 >>> (8 - this.bitWidth)))
    if (this.literal === LITERAL.BITS) {
      return { value: tinyInt, end: address }
    }
    const shortIntBytes = uint8ArrayLayer.slice(address - tinyInt, address)
    if (this.literal === LITERAL.VARIABLE) {
      return {
        value: shortIntBytes,
        end: address - shortIntBytes.length
      }
    }
    if (this.literal === LITERAL.LENGTH_TERMINATED) {
      const code = uint8ArrayLayer.slice(address - tinyInt, address)
      const length = decodeVariable(code)
      return {
        value: code,
        end: address - code.length - length
      }
    }
  }
}

export class Codec {
  /**
   * @param {string} name
   * @param {number} footerPrefix
   * @param {Array.<Block>} blocks
   * @param {Array.<Symbol>} kinds
   * @param {(value:any)=>boolean} test
   * @param {(upserter:import('./schema.js').Upserter, value:any)=>Array.<Uint8Array>} valueToBlocks
   * @param {(uint8ArrayLayer:import('./Uint8ArrayLayer.js').Uint8ArrayLayer, encodedBlocks:Array.<Uint8Array>)=>any} blocksToValue
   */
  constructor ({ name, footerPrefix, test, blocks, kinds, valueToBlocks, blocksToValue }) {
    this.name = name
    this.footerPrefix = footerPrefix
    this.blocks = blocks
    this.blocksBitWidth = blocks.reduce((sum, block) => sum + block.bitWidth, 0)
    this.kinds = kinds
    this.test = test
    this.valueToBlocks = valueToBlocks
    this.blocksToValue = blocksToValue
  }

  prefixMatch (footer) {
    return footer >>> this.blocksBitWidth === this.footerPrefix
  }

  encode (upserter, value) {
    const uint8Arrays = this.valueToBlocks(upserter, value, this)
    if (uint8Arrays.length !== this.blocks.length) throw new Error('valueToBlocks output/blocks mismatch')
    let bitOffset = this.blocksBitWidth
    let footer = this.footerPrefix << bitOffset
    const blocks = uint8Arrays.map((uint8Array, index) => {
      const block = this.blocks[index]
      const { value, bits } = block.encodeBlock(uint8Array)
      bitOffset -= block.bitWidth
      footer |= bits << bitOffset
      return value
    })
    return collapseUint8Arrays(...blocks, footer)
  }

  /**
   * @param {import('./Uint8ArrayLayer.js').Uint8ArrayLayer} uint8ArrayLayer
   * @param {number} address
   * @param {number} footer
   * @returns {any}
   */
  decodeValue (uint8ArrayLayer, address, footer) {
    const { blocks } = this.decodeBlocksAndNextAddress(uint8ArrayLayer, address, footer)
    return this.blocksToValue(uint8ArrayLayer, blocks, address)
  }

  /**
   * @param {import('./Uint8ArrayLayer.js').Uint8ArrayLayer} uint8ArrayLayer
   * @param {number} address
   * @param {number} footer
   * @returns {{blocks: Array.<Block>, nextAddress: number}}
   */
  decodeBlocksAndNextAddress (uint8ArrayLayer, address, footer) {
    let bitOffset = 8
    const blocks = []
    for (let i = this.blocks.length - 1; i >= 0; --i) {
      const block = this.blocks[i]
      const { value, end } = block.decodeBlock(uint8ArrayLayer, address, footer, bitOffset)
      blocks[i] = value
      address = end
      bitOffset -= block.bitWidth
    }
    return { blocks, nextAddress: address - 1 }
  }

  /**
   * @param {number} footer
   * @param {Array.<Codec>} codecs
   * @returns {Codec}
   */
  static calculateCodec (footer, codecs) {
    const codec = (codecs.length > 1) ? codecs.find(codec => codec.prefixMatch(footer)) : codecs[0]
    if (!codec) {
      console.error({ footer, codecs })
      throw new Error('no codec matched')
    }
    return codec
  }
}

const typedArrays = [Int8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array]

const IS_PARTIAL = Symbol('partial')

const setPartial = array => {
  array[IS_PARTIAL] = true
  return array
}

const unsetPartial = array => {
  delete array[IS_PARTIAL]
  return array
}

export const ksVsToPairs = ksVs => {
  const length = ksVs.length / 2
  return ksVs.slice(0, length).map((k, i) => [k, ksVs[length + i]])
}
const recoverPairLabel = (pairs, uint8ArrayLayer) => pairs.map(([key, value]) => [uint8ArrayLayer.lookup(key), value])
const valuesToAddresses = (values, upserter) => values.map(value => upserter.upsert(value))

export const KIND = {
  TOP: Symbol('top level codec'),
  UINT8ARRAY: Symbol('Uint8Array codec'),
  PARTIAL_ARRAY: Symbol('partial codec'),
  OBJECT: Symbol('object codec'),
  REFS_TOP: Symbol('*top level codec'),
  REF: Symbol('*bottom level codec'),
  REFS_UINT8ARRAY: Symbol('*Uint8Array codec'),
  REFS_PARTIAL_ARRAY: Symbol('*partial codec'),
  REFS_OBJECT: Symbol('*object codec'),
  OPAQUE: Symbol('uninterpreted data')
}

export const CODEC = {
  UNDEFINED: new Codec({
    name: 'undefined',
    footerPrefix: 0b00000000,
    test: value => value === undefined,
    blocks: [],
    kinds: [KIND.TOP],
    valueToBlocks: () => [],
    blocksToValue: () => undefined
  }),
  NULL: new Codec({
    name: 'null',
    footerPrefix: 0b00000001,
    test: value => value === null,
    blocks: [],
    kinds: [KIND.TOP],
    valueToBlocks: () => [],
    blocksToValue: () => null
  }),
  FALSE: new Codec({
    name: 'boolean(false)',
    footerPrefix: 0b00000010,
    test: value => value === false,
    blocks: [],
    kinds: [KIND.TOP],
    valueToBlocks: () => [],
    blocksToValue: () => false
  }),
  TRUE: new Codec({
    name: 'boolean(true)',
    footerPrefix: 0b00000011,
    test: value => value === true,
    blocks: [],
    kinds: [KIND.TOP],
    valueToBlocks: () => [],
    blocksToValue: () => true
  }),
  NUMBER: new Codec({
    name: 'number',
    footerPrefix: 0b000001,
    test: value => (typeof value === 'number'),
    blocks: [new Block(2, 2)],
    kinds: [KIND.TOP],
    valueToBlocks: (upserter, value) => [
      encodeVariable(upserter.upsert(new Uint8Array(new Float64Array([value]).buffer), getCodecs(KIND.UINT8ARRAY)))
    ],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => new Float64Array(
      uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]), getCodecs(KIND.UINT8ARRAY)).buffer
    )[0]
  }),
  STRING: new Codec({
    name: 'string',
    footerPrefix: 0b000010,
    test: value => (typeof value === 'string'),
    blocks: [new Block(2, 2)],
    kinds: [KIND.TOP],
    valueToBlocks: (upserter, value) => [encodeVariable(upserter.upsert((new TextEncoder()).encode(value), getCodecs(KIND.UINT8ARRAY)))],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => (new TextDecoder()).decode(
      uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]), getCodecs(KIND.UINT8ARRAY))
    )
  }),
  DATE: new Codec({
    name: 'date',
    footerPrefix: 0b000011,
    test: value => value instanceof Date,
    blocks: [new Block(2, 2)],
    kinds: [KIND.TOP],
    valueToBlocks: (upserter, value) => [
      encodeVariable(upserter.upsert(new Uint8Array(new Float64Array([value.getTime()]).buffer), getCodecs(KIND.UINT8ARRAY)))
    ],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => new Date(
      new Float64Array(uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]), getCodecs(KIND.UINT8ARRAY)).buffer)[0]
    )
  }),
  BIGINT: new Codec({
    name: 'bigint',
    footerPrefix: 0b00010,
    test: value => (typeof value === 'bigint'),
    blocks: [new Block(1, 0, LITERAL.BITS), new Block(2, 2)],
    kinds: [KIND.TOP],
    valueToBlocks: (upserter, value) => {
      const isNegative = value < 0n ? 1 : 0
      const sign = isNegative ? -1n : 1n
      let bigintHex = (sign * value).toString(16)
      if (bigintHex.length % 2) bigintHex = `0${bigintHex}`
      const uint8Array = new Uint8Array(bigintHex.match(/.{1,2}/g).map(hex => parseInt(hex, 16)))
      return [isNegative, encodeVariable(upserter.upsert(uint8Array, getCodecs(KIND.UINT8ARRAY)))]
    },
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => {
      const sign = encodedBlocks[0] ? -1n : 1n
      const uint8Array = uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[1]), getCodecs(KIND.UINT8ARRAY))
      return sign * BigInt(`0x${[...uint8Array].map(byte => `0${byte.toString(16)}`.slice(-2)).join('')}`)
    }
  }),
  UINT8ARRAY_SHORT: new Codec({
    name: 'Uint8Array(length<=4)',
    footerPrefix: 0b00111,
    test: value => (value instanceof Uint8Array && value.length <= 4),
    blocks: [new Block(3)],
    kinds: [KIND.TOP, KIND.UINT8ARRAY],
    valueToBlocks: (_upserter, value) => [value],
    blocksToValue: (_uint8ArrayLayer, encodedBlocks) => encodedBlocks[0]
  }),
  UINT8ARRAY_LONG: new Codec({
    name: 'Uint8Array(length>4)',
    footerPrefix: 0b0100,
    test: value => (value instanceof Uint8Array),
    blocks: [new Block(2, 2), new Block(2, 2)],
    kinds: [KIND.TOP, KIND.UINT8ARRAY],
    valueToBlocks: (upserter, value) => {
      const leftLength = 2 ** (31 - Math.clz32(value.length - 1))
      return [
        encodeVariable(upserter.upsert(value.slice(0, leftLength), getCodecs(KIND.UINT8ARRAY))),
        encodeVariable(upserter.upsert(value.slice(leftLength), getCodecs(KIND.UINT8ARRAY)))
      ]
    },
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => collapseUint8Arrays(
      ...encodedBlocks.map(value => uint8ArrayLayer.lookup(decodeVariable(value), getCodecs(KIND.UINT8ARRAY)))
    )
  }),
  ARRAY: new Codec({
    name: 'array',
    footerPrefix: 0b000111,
    test: value => Array.isArray(value),
    blocks: [new Block(2, 2)],
    kinds: [KIND.TOP],
    valueToBlocks: (upserter, value) => {
      const keys = Object.keys(value)
      if (JSON.stringify(keys) === JSON.stringify(Object.keys([...value]))) {
        return [encodeVariable(upserter.upsert(value, getCodecs(KIND.PARTIAL_ARRAY)))]
      } else {
        return [encodeVariable(upserter.upsert(Object.assign({}, value, { length: value.length }), getCodecs(KIND.OBJECT)))]
      }
    },
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => {
      let array = uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]), getCodecs(KIND.PARTIAL_ARRAY, KIND.OBJECT))
      if (Array.isArray(array)) array = unsetPartial(array)
      return Object.assign([], array)
    }
  }),
  PARTIAL_LONG: new Codec({
    name: 'partial(length>1)',
    footerPrefix: 0b0010,
    test: value => value?.length > 1,
    blocks: [new Block(2, 2), new Block(2, 2)],
    kinds: [KIND.PARTIAL_ARRAY],
    valueToBlocks: (upserter, value) => {
      const leftLength = 2 ** (31 - Math.clz32(value.length - 1))
      return [
        encodeVariable(upserter.upsert(value.slice(0, leftLength), getCodecs(KIND.PARTIAL_ARRAY))),
        encodeVariable(upserter.upsert(value.slice(leftLength), getCodecs(KIND.PARTIAL_ARRAY)))
      ]
    },
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => setPartial(encodedBlocks.map(value => {
      const partialArray = uint8ArrayLayer.lookup(decodeVariable(value), getCodecs(KIND.PARTIAL_ARRAY, KIND.TOP))
      return partialArray?.[IS_PARTIAL] ? partialArray : [partialArray]
    }).flat())
  }),
  PARTIAL_SHORT: new Codec({
    name: 'partial(length=1)',
    footerPrefix: 0b001100,
    test: value => value?.length === 1,
    blocks: [new Block(2, 2)],
    kinds: [KIND.PARTIAL_ARRAY],
    valueToBlocks: (upserter, value) => [encodeVariable(upserter.upsert(value[0]))],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => setPartial([uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]))])
  }),
  PARTIAL_EMPTY: new Codec({
    name: 'partial(length=0)',
    footerPrefix: 0b00110100,
    test: value => value?.length === 0,
    blocks: [],
    kinds: [KIND.PARTIAL_ARRAY],
    valueToBlocks: () => [],
    blocksToValue: () => setPartial([])
  }),
  TYPED_ARRAY: new Codec({
    name: 'TypedArray',
    footerPrefix: 0b10,
    test: value => (value instanceof Object.getPrototypeOf(Uint8Array)),
    blocks: [new Block(4, 0, LITERAL.BITS), new Block(2, 2)],
    kinds: [KIND.TOP],
    valueToBlocks: (upserter, value) => [
      typedArrays.findIndex(typedArray => value instanceof typedArray),
      encodeVariable(upserter.upsert(new Uint8Array(value.buffer), getCodecs(KIND.UINT8ARRAY)))
    ],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => new typedArrays[encodedBlocks[0]](
      uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[1]), getCodecs(KIND.UINT8ARRAY)).buffer
    )
  }),
  MAP: new Codec({
    name: 'map',
    footerPrefix: 0b111101,
    test: value => value instanceof Map,
    blocks: [new Block(2, 2)],
    kinds: [KIND.TOP],
    valueToBlocks: (upserter, value) => [
      encodeVariable(upserter.upsert([...value.keys(), ...value.values()], getCodecs(KIND.PARTIAL_ARRAY)))
    ],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => new Map(
      ksVsToPairs(uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]), getCodecs(KIND.PARTIAL_ARRAY)))
    )
  }),
  SET: new Codec({
    name: 'set',
    footerPrefix: 0b111110,
    test: value => value instanceof Set,
    blocks: [new Block(2, 2)],
    kinds: [KIND.TOP],
    valueToBlocks: (upserter, value) => [
      encodeVariable(upserter.upsert([...value.values()], getCodecs(KIND.PARTIAL_ARRAY)))
    ],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => new Set(
      uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]), getCodecs(KIND.PARTIAL_ARRAY))
    )
  }),
  OBJECT: new Codec({
    name: 'object',
    footerPrefix: 0b111111,
    test: value => (typeof value === 'object'),
    blocks: [new Block(2, 2)],
    kinds: [KIND.TOP, KIND.OBJECT],
    valueToBlocks: (upserter, value) => [
      encodeVariable(upserter.upsert([...Object.keys(value), ...Object.values(value)], getCodecs(KIND.PARTIAL_ARRAY)))
    ],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => Object.fromEntries(
      ksVsToPairs(uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]), getCodecs(KIND.PARTIAL_ARRAY)))
    )
  }),

  /* reference codecs */
  ARRAY_REF: new Codec({
    name: '*array',
    footerPrefix: 0b000111,
    test: value => Array.isArray(value),
    blocks: [new Block(2, 2)],
    kinds: [KIND.REFS_TOP],
    valueToBlocks: (upserter, value) => {
      const keys = Object.keys(value)
      if (JSON.stringify(keys) === JSON.stringify(Object.keys([...value]))) {
        return [encodeVariable(upserter.upsert(value, getCodecs(KIND.REFS_PARTIAL_ARRAY)))]
      } else {
        return [encodeVariable(upserter.upsert(Object.assign({}, value, { length: upserter.upsert(value.length) }), getCodecs(KIND.REFS_OBJECT)))]
      }
    },
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => {
      const array = uint8ArrayLayer.lookup(
        decodeVariable(encodedBlocks[0]), getCodecs(KIND.REFS_PARTIAL_ARRAY, KIND.REFS_OBJECT)
      )
      if (Array.isArray(array)) return unsetPartial(array)
      return Object.assign([], array, { length: uint8ArrayLayer.lookup(array.length) })
    }
  }),
  PARTIAL_LONG_REF: new Codec({
    name: '*partial(length>1)',
    footerPrefix: 0b0010,
    test: value => value?.length > 1,
    blocks: [new Block(2, 2), new Block(2, 2)],
    kinds: [KIND.REFS_PARTIAL_ARRAY],
    valueToBlocks: (upserter, value) => {
      const leftLength = 2 ** (31 - Math.clz32(value.length - 1))
      return [
        encodeVariable(upserter.upsert(value.slice(0, leftLength), getCodecs(KIND.REFS_PARTIAL_ARRAY))),
        encodeVariable(upserter.upsert(value.slice(leftLength), getCodecs(KIND.REFS_PARTIAL_ARRAY)))
      ]
    },
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => setPartial(encodedBlocks.map(value => {
      const partialArray = uint8ArrayLayer.lookup(
        decodeVariable(value), getCodecs(KIND.REFS_PARTIAL_ARRAY, KIND.REFS_TOP)
      )
      return partialArray?.[IS_PARTIAL] ? partialArray : [partialArray]
    }).flat())
  }),
  PARTIAL_SHORT_REF: new Codec({
    name: '*partial(length=1)',
    footerPrefix: 0b001100,
    test: value => value?.length === 1,
    blocks: [new Block(2, 2)],
    kinds: [KIND.REFS_PARTIAL_ARRAY],
    valueToBlocks: (_upserter, value) => [encodeVariable(value[0])],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => setPartial([uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]), getCodecs(KIND.REF))])
  }),
  PARTIAL_EMPTY_REF: new Codec({
    name: '*partial(length=0)',
    footerPrefix: 0b00110100,
    test: value => value?.length === 0,
    blocks: [],
    kinds: [KIND.REFS_PARTIAL_ARRAY],
    valueToBlocks: () => [],
    blocksToValue: () => setPartial([])
  }),
  MAP_REF: new Codec({
    name: '*map',
    footerPrefix: 0b111101,
    test: value => value instanceof Map,
    blocks: [new Block(2, 2)],
    kinds: [KIND.REFS_TOP],
    valueToBlocks: (upserter, value) => [
      encodeVariable(upserter.upsert([...value.keys(), ...value.values()], getCodecs(KIND.REFS_PARTIAL_ARRAY)))
    ],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => new Map(
      ksVsToPairs(uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]), getCodecs(KIND.REFS_PARTIAL_ARRAY))),
      uint8ArrayLayer
    )
  }),
  SET_REF: new Codec({
    name: '*set',
    footerPrefix: 0b111110,
    test: value => value instanceof Set,
    blocks: [new Block(2, 2)],
    kinds: [KIND.REFS_TOP],
    valueToBlocks: (upserter, value) => [
      encodeVariable(upserter.upsert([...value.values()], getCodecs(KIND.REFS_PARTIAL_ARRAY)))
    ],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => new Set(
      uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]), getCodecs(KIND.REFS_PARTIAL_ARRAY))
    )
  }),
  OBJECT_REF: new Codec({
    name: '*object',
    footerPrefix: 0b111111,
    test: value => (value && typeof value === 'object' && !(value instanceof Date)),
    blocks: [new Block(2, 2)],
    kinds: [KIND.REFS_TOP, KIND.REFS_OBJECT],
    valueToBlocks: (upserter, value) => [
      encodeVariable(upserter.upsert([
        ...valuesToAddresses(Object.keys(value), upserter),
        ...Object.values(value)
      ], getCodecs(KIND.REFS_PARTIAL_ARRAY)))
    ],
    blocksToValue: (uint8ArrayLayer, encodedBlocks) => Object.fromEntries(recoverPairLabel(
      ksVsToPairs(uint8ArrayLayer.lookup(decodeVariable(encodedBlocks[0]), getCodecs(KIND.REFS_PARTIAL_ARRAY))),
      uint8ArrayLayer
    ))
  }),
  OPAQUE: new Codec({
    name: '__opaque(uint8Array)__',
    footerPrefix: 0b000110, // only ever looked for explicitely
    test: () => true,
    blocks: [new Block(2, 1, LITERAL.LENGTH_TERMINATED)],
    kinds: [KIND.TOP, KIND.OPAQUE],
    valueToBlocks: (_upserter, value) => [value],
    blocksToValue: (uint8ArrayLayer, encodedBlocks, address) => {
      const [encodedLength] = encodedBlocks
      const length = decodeVariable(encodedLength)
      address = address - length - encodedLength.length
      return uint8ArrayLayer.slice(address, address + length)
    }
  }),
  ANY_REF: new Codec({
    name: '*any',
    footerPrefix: 0b0, // matches any-single-byte >>> 8
    test: () => true,
    blocks: [new Block(8, 0, LITERAL.BITS)],
    kinds: [KIND.REFS_TOP, KIND.REF],
    valueToBlocks: (_upserter, value) => [encodeVariable(value)],
    blocksToValue: (_uint8ArrayLayer, _encodedBlocks, address) => address
  })
}

/** @type {Array.<Codec>} */
export const ALL_CODECS = Object.values(CODEC)

/** @type {Object.<string,Array.<Codec>>} */
const codecsByKind = {}
for (const codec of ALL_CODECS) {
  for (const kind of codec.kinds) {
    codecsByKind[kind] ??= []
    codecsByKind[kind].push(codec)
  }
}

/**
 * @param {symbol} [kind=KIND.TOP]
 * @param {...symbol} kinds
 * @returns {Array.<Codec>}
 */
export function getCodecs (kind = KIND.TOP, ...kinds) {
  return codecsByKind[kind].concat(...kinds.map(kind => codecsByKind[kind]))
}

// for (let i = 0; i <= 0b11111111; ++i) console.log(`0000000${i.toString(2)}`.slice(-8), ALL_CODECS.filter(codec => codec.prefixMatch(i)).map(codec => codec.name))
