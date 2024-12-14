export function combineUint8ArrayLikes (uint8ArrayLikes) {
  const uint8Arrays = uint8ArrayLikes.map(uint8ArrayLike => {
    if (uint8ArrayLike instanceof Uint8Array) return uint8ArrayLike
    if (uint8ArrayLike instanceof Object.getPrototypeOf(Uint8Array)) return new Uint8Array(uint8ArrayLike.buffer)
    if (Number.isInteger(uint8ArrayLike) && uint8ArrayLike <= 0xff) return new Uint8Array([uint8ArrayLike])
    console.error(uint8ArrayLikes)
    throw new Error('can\'t convert to Uint8Array')
  })
  return combineUint8Arrays(uint8Arrays)
}

export function combineUint8Arrays (uint8Arrays) {
  console.log(uint8Arrays)
  const combinedLength = uint8Arrays.reduce((length, uint8Array) => length + (uint8Array?.length ?? 0), 0)
  const collapsedUint8Array = new Uint8Array(combinedLength)
  console.log(collapsedUint8Array)
  let address = 0
  for (const uint8Array of uint8Arrays) {
    if (uint8Array?.length) {
      collapsedUint8Array.set(uint8Array, address)
      address += uint8Array.length
    }
  }
  return collapsedUint8Array
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
