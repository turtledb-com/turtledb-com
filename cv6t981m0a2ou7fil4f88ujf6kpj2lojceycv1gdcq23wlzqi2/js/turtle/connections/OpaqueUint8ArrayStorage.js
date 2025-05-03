import { OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
/**
 * @typedef {import('../TurtleBranch.js').TurtleBranch} TurtleBranch
 */

export class OpaqueUint8ArrayStorage {
  /**
   * @param {(Uint8Array) => number} upsert
   * @param {(number) => Uint8Array} lookup
   */
  constructor (upsert, lookup) {
    this.upsert = upsert
    this.lookup = lookup
  }

  /**
   * @param {TurtleBranch} turtleBranch
   * @returns {OpaqueUint8ArrayStorage}
   */
  static fromTurtleBranch (turtleBranch) {
    return new OpaqueUint8ArrayStorage(
      (uint8Array) => turtleBranch.append(OPAQUE_UINT8ARRAY.encode(uint8Array)),
      (address) => turtleBranch.lookup(address)
    )
  }
}
