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
  /** @type {number} */
  value
  /** @type {Uint8Array} */
  #appendix
  /** @type {Object.<string, ValueByUint8Array>} */
  #childrenByBit = {}
  /**
   * @param {Uint8Array} uint8Array
   * @returns any
   */
  get (uint8Array) {
    if (!uint8Array.length) return this.value
    else if (this.#appendix) {
      const { bytes, bits } = ValueByUint8Array.commonPrefix(this.#appendix, uint8Array)
      return this.#childrenByBit[bits]?.get?.(uint8Array.slice(bytes))
    }
  }

  /**
   * @param {Uint8Array} uint8Array
   * @param {any} value
   */
  set (uint8Array, value) {
    if (!uint8Array.length) {
      if (this.value !== undefined) throw new Error('Existing value')
      this.value = value
      return
    }
    this.#appendix ??= uint8Array
    if (!this.#appendix) this.#appendix = uint8Array
    const { bytes, bits } = ValueByUint8Array.commonPrefix(this.#appendix, uint8Array)
    this.#childrenByBit[bits] ??= new ValueByUint8Array()
    this.#childrenByBit[bits].set(uint8Array.slice(bytes), value)
  }

  toObj () {
    if (!this.#appendix) return { value: this.value }
    return {
      value: this.value,
      u8a: [...this.#appendix].map(v => `0000000${v.toString(2)}`.slice(-8)).join('.'),
      byBit: Object.fromEntries(Object.entries(this.#childrenByBit).map(([key, value]) => [key, value.toObj()]))
    }
  }

  toString () {
    return JSON.stringify(this.toObj(), null, 2)
  }

  /**
   * @param {Uint8Array} a
   * @param {Uint8Array} b
   * @returns {number}
   */
  static commonPrefix (a, b) {
    let bytes = 0
    while (bytes < a.length && bytes < b.length && a[bytes] === b[bytes]) ++bytes
    if (bytes === a.length || bytes === b.length) return { bytes, bits: bytes * 8 }
    const bits = 8 * bytes + Math.clz32(a[bytes] ^ b[bytes]) - 24
    return { bytes, bits }
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
export function softAssign (a, b) {
  let changed = false
  const aKeys = Object.keys(a)
  for (const i of aKeys) {
    if (i in b) { // softAssign any overlapping attributes
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
          changed = softAssign(a[i], b[i]) && changed
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
    if (!(i in a)) {
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
