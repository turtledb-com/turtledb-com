export const OWN_KEYS = Symbol('ownKeys')

/**
 * @param {Array.<number>} versionArrayCounts
 * @return number
 */
export const toVersionCount = versionArrayCounts => versionArrayCounts.reduce((acc, value) => acc * value, 1)

/**
 * @param {number} combinedVersion
 * @param {Array.<number>} versionArrayCounts
 * @return {Array.<number}
 */
export const toSubVersions = (combinedVersion, versionArrayCounts) => {
  const versionArrays = new Array(versionArrayCounts.length)
  for (let i = versionArrays.length - 1; i >= 0; --i) {
    const versionArrayCount = versionArrayCounts[i]
    versionArrays[i] = combinedVersion % versionArrayCount
    combinedVersion = Math.floor(combinedVersion / versionArrayCount)
  }
  return versionArrays
}

/**
 * @param {Array.<number>} versionArrays
 * @param {Array.<number>} versionArrayCounts
 * @return number
 */
export const toCombinedVersion = (versionArrays, versionArrayCounts) => {
  if (versionArrays.length !== versionArrayCounts.length) throw new Error('versionArrays/versionArrayCounts mismatch')
  let combinedVersion = 0
  for (let i = 0; i < versionArrays.length; ++i) {
    combinedVersion *= versionArrayCounts[i]
    combinedVersion += versionArrays[i]
  }
  return combinedVersion
}

/**
 * @param {Array.<any>} uint8ArrayLikes
 * @returns {Uint8Array}
 */
export function combineUint8ArrayLikes (uint8ArrayLikes) {
  if (!Array.isArray(uint8ArrayLikes)) throw new Error('friendly reminder... combineUint8ArrayLikes accepts an array of Uint8ArrayLikes')
  const uint8Arrays = uint8ArrayLikes.map(uint8ArrayLike => {
    if (uint8ArrayLike instanceof Uint8Array) return uint8ArrayLike
    if (uint8ArrayLike instanceof Object.getPrototypeOf(Uint8Array)) return new Uint8Array(uint8ArrayLike.buffer)
    if (Number.isInteger(uint8ArrayLike) && uint8ArrayLike <= 0xff) return new Uint8Array([uint8ArrayLike])
    console.error(uint8ArrayLikes)
    throw new Error('can\'t convert to Uint8Array')
  })
  return combineUint8Arrays(uint8Arrays)
}

/**
 * @param {Array.<Uint8Array>} uint8Arrays
 * @returns {Uint8Array}
 */
export function combineUint8Arrays (uint8Arrays) {
  if (!Array.isArray(uint8Arrays)) throw new Error('friendly reminder... combineUint8Arrays accepts an array of Uint8Arrays')
  const combinedLength = uint8Arrays.reduce((length, uint8Array) => length + (uint8Array?.length ?? 0), 0)
  const collapsedUint8Array = new Uint8Array(combinedLength)
  let address = 0
  for (const uint8Array of uint8Arrays) {
    if (!(uint8Array instanceof Uint8Array)) {
      console.error('not Uint8Array', uint8Array)
      throw new Error('combineUint8Arrays can only combine Uint8Arrays')
    }
    if (uint8Array?.length) {
      collapsedUint8Array.set(uint8Array, address)
      address += uint8Array.length
    }
  }
  return collapsedUint8Array
}

/**
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns boolean
 */
export function compareUint8Arrays (a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index])
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
 *                                                                 |                                                               |
 *                                 |                               |                               |                               |
 *                 |               |               |               |               |               |               |               |
 *         |       |       |       |       |       |       |       |       |       |       |       |       |       |       |       |
 *     |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |
 *   | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | |
 *  ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
 * zabacabadabacabaeabacabadabacabafabacabadabacabaeabacabadabacabagabacabadabacabaeabacabadabacabafabacabadabacabaeabacabadabacaba
 * like the "ruler function" (abacaba) but with numbers for binary-tree-like jumping
 * @param {number} i
 * @returns {number}
 */
export function zabacaba (i) {
  if (i === 0) return 0
  if (i === 1) return 1
  const j = ~(i - 1)
  const b = Math.clz32(j & -j) // 31 - b is right zeros
  return 32 - b
}

/**
 * @param {string} b36
 * @returns {bigint}
 */
export function parseB36 (b36) {
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
  return bigIntToUint8Array(parseB36(b36))
}

/**
 * @param {Uint8Array} uint8Array
 * @returns {string}
 */
export function uint8ArrayToB36 (uint8Array) {
  return uint8ArrayToBigInt(uint8Array).toString(36)
}

/**
 * @param {Object} target
 * @param {import('../utils/Recaller.js').Recaller} recaller
 */
export function proxyWithRecaller (target, recaller, name = '<unnamed proxyWithRecaller>') {
  if (!target || typeof target !== 'object') throw new Error('proxyWithRecaller can only proxy objects')
  return new Proxy(target, {
    has: (target, propertyKey) => {
      recaller.reportKeyAccess(target, propertyKey, 'get', name)
      return Reflect.has(target, propertyKey)
    },
    get: (target, propertyKey) => {
      recaller.reportKeyAccess(target, propertyKey, 'get', name)
      if (propertyKey === 'length' && Array.isArray(target)) return target.length
      return Reflect.get(target, propertyKey)
    },
    set: (target, propertyKey, value) => {
      const length = target.length
      if (value !== target[propertyKey]) {
        recaller.reportKeyMutation(target, propertyKey, 'set', name)
      }
      if (!Object.hasOwn(target, propertyKey)) {
        recaller.reportKeyMutation(target, OWN_KEYS, 'set', name)
      }
      const result = Reflect.set(target, propertyKey, value)
      if (Array.isArray(target) && length !== target.length) {
        recaller.reportKeyMutation(target, 'length', 'set', name)
      }
      return result
    },
    deleteProperty: (target, propertyKey) => {
      if (Object.hasOwn(target, propertyKey)) {
        recaller.reportKeyMutation(target, OWN_KEYS, 'delete', name)
      }
      return Reflect.deleteProperty(target, propertyKey)
    },
    ownKeys: target => {
      recaller.reportKeyAccess(target, OWN_KEYS, 'ownKeys', name)
      return Reflect.ownKeys(target)
    }
  })
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
        if (
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
