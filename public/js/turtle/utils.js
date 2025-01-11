/**
 * @param {Array.<number>} subVersionCounts
 * @return number
 */
export const toVersionCount = subVersionCounts => subVersionCounts.reduce((acc, value) => acc * value, 1)

/**
 * @param {number} combinedVersion
 * @param {Array.<number>} subVersionCounts
 * @return {Array.<number}
 */
export const toSubVersions = (combinedVersion, subVersionCounts) => {
  const subVersions = new Array(subVersionCounts.length)
  for (let i = subVersions.length - 1; i >= 0; --i) {
    const subVersionCount = subVersionCounts[i]
    subVersions[i] = combinedVersion % subVersionCount
    combinedVersion = Math.floor(combinedVersion / subVersionCount)
  }
  return subVersions
}

/**
 * @param {Array.<number>} subVersions
 * @param {Array.<number>} subVersionCounts
 * @return number
 */
export const toCombinedVersion = (subVersions, subVersionCounts) => {
  if (subVersions.length !== subVersionCounts.length) throw new Error('subVersions/subVersionCounts mismatch')
  let combinedVersion = 0
  for (let i = 0; i < subVersions.length; ++i) {
    combinedVersion *= subVersionCounts[i]
    combinedVersion += subVersions[i]
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
