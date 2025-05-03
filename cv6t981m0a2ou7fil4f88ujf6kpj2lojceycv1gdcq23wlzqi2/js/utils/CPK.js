import { b36ToBigInt, b36ToUint8Array, bigIntToUint8Array, uint8ArrayToB36, uint8ArrayToBigInt } from '../turtle/utils.js'

export const CPK = {
  toString: value => {
    if (value instanceof Uint8Array) return uint8ArrayToB36(value)
    if (typeof value === 'bigint') return value.toString(36)
    if (typeof value === 'string') return value
    throw new Error('bad type for compact public key')
  },
  toUint8Array: value => {
    if (typeof value === 'string') return b36ToUint8Array(value)
    if (typeof value === 'bigint') bigIntToUint8Array(value)
    if (value instanceof Uint8Array) return value
    throw new Error('bad type for compact public key')
  },
  toBigInt: value => {
    if (value instanceof Uint8Array) return uint8ArrayToBigInt(value)
    if (typeof value === 'string') return b36ToBigInt(value)
    if (typeof value === 'bigint') return value
    throw new Error('bad type for compact public key')
  }
}
