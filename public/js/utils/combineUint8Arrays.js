import { logError } from './logger.js'

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
      logError(() => console.error('not Uint8Array', uint8Array))
      throw new Error('combineUint8Arrays can only combine Uint8Arrays')
    }
    if (uint8Array?.length) {
      collapsedUint8Array.set(uint8Array, address)
      address += uint8Array.length
    }
  }
  return collapsedUint8Array
}
