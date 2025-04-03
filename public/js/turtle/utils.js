/**
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns boolean
 */
export function deepEqualUint8Arrays (a, b) {
  return a === b || (a.length === b.length && a.every((value, index) => value === b[index]))
}

export const encodeNumberToU8a = (number, minimumLength = 2) => {
  if (typeof number !== 'number') throw new Error('addresses are numbers')
  if (Number.isNaN(number)) throw new Error('addresses are not NaN')
  const asBytes = [...new Uint8Array(new BigUint64Array([BigInt(number)]).buffer)]
  while (asBytes.length > minimumLength && !asBytes[asBytes.length - 1]) asBytes.pop()
  return new Uint8Array(asBytes)
}

export const decodeNumberFromU8a = uint8Array => {
  const asBytes = new Uint8Array(8)
  asBytes.set(uint8Array)
  return Number(new BigUint64Array(asBytes.buffer)[0])
}

export class ValueByUint8Array {
  #root = {}
  /**
   * @param {Uint8Array} uint8Array
   * @returns any
   */
  get (uint8Array) {
    let branch = this.#root
    for (const byte of uint8Array) {
      branch = branch[byte]
      if (branch === undefined) return undefined
    }
    return branch.value
  }

  /**
   * @param {Uint8Array} uint8Array
   * @param {any} value
   */
  set (uint8Array, value) {
    let branch = this.#root
    for (const byte of uint8Array) {
      branch[byte] ??= {}
      branch = branch[byte]
    }
    branch.value = value
  }
}

/**
 * @param {string} b36
 * @returns {bigint}
 */
export function b36ToBigInt (b36) {
  return b36.split('').reduce(
    (acc, char) => acc * 36n + BigInt(parseInt(char, 36)),
    0n
  )
}

/**
 * @param {BigInt} bigInt
 * @returns {Uint8Array}
 */
export function bigIntToUint8Array (bigInt) {
  let hex = bigInt.toString(16)
  if (hex.length % 2) hex = `0${hex}`
  return new Uint8Array(hex.match(/../g).map(hexByte => parseInt(hexByte, 16)))
}

/**
 * @param {Uint8Array} uint8Array
 * @returns {BigInt}
 */
export function uint8ArrayToBigInt (uint8Array) {
  return uint8Array.reduce((acc, byte) => acc * 256n + BigInt(byte), 0n)
}

/**
 * @param {string} b36
 * @returns {Uint8Array}
 */
export function b36ToUint8Array (b36) {
  return bigIntToUint8Array(b36ToBigInt(b36))
}

/**
 * @param {Uint8Array} uint8Array
 * @returns {string}
 */
export function uint8ArrayToB36 (uint8Array) {
  return uint8ArrayToBigInt(uint8Array).toString(36)
}

/**
 * @param {Object} a
 * @param {Object} b
 */
export function softSet (a, b) {
  let changed = false
  const aKeys = Object.keys(a)
  for (const i of aKeys) {
    if (Object.hasOwn(b, i)) { // softSet any overlapping attributes
      if (a[i] !== b[i]) {
        if (!a[i] || !b[i]) {
          a[i] = b[i]
          changed = true
        } if (a[i] instanceof Uint8Array && b[i] instanceof Uint8Array) {
          changed = deepEqualUint8Arrays(a[i], b[i]) && changed
        } else if (
          typeof a[i] === 'object' && typeof b[i] === 'object' &&
          Array.isArray(a[i]) === Array.isArray(b[i])
        ) {
          changed = softSet(a[i], b[i]) && changed
        } else {
          a[i] = b[i]
          changed = true
        }
      }
    } else { // remove any extra attributes
      delete a[i]
      changed = true
    }
  }
  for (const i in b) { // add missing attributes
    if (!Object.hasOwn(a, i)) {
      a[i] = b[i]
      changed = true
    }
  }
  if (Array.isArray(b) && a.length !== b.length) {
    a.length = b.length
    changed = true
  }
  return changed
}

export const defaultHostname = 'turtledb.com'

export const pathToCpkBaleHost = path => {
  const parts = path.split(/\//)
  const cpk = parts.pop()
  const balename = parts.pop() ?? cpk
  const hostname = parts.pop() ?? defaultHostname
  return [cpk, balename, hostname]
}

export const cpkBaleHostToPath = (cpk, balename = cpk, hostname = defaultHostname) => {
  const parts = [cpk]
  if (balename !== cpk || hostname !== defaultHostname) {
    parts.unshift(balename)
    if (hostname !== defaultHostname) parts.unshift(hostname)
  }
  return parts.join('/')
}
