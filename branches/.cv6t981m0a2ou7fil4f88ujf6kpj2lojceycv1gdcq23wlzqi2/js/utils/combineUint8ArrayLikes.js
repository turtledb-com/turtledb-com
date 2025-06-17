import { combineUint8Arrays } from './combineUint8Arrays.js'
import { logError } from './logger.js'

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
    logError(() => console.error(uint8ArrayLikes))
    throw new Error('can\'t convert to Uint8Array')
  })
  return combineUint8Arrays(uint8Arrays)
}
