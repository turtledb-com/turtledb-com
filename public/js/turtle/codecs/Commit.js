export class Commit {
  /**
   * @param {Object} value
   * @param {Uint8Array} signature
   */
  constructor (value, signature) {
    this.value = value
    this.signature = signature
  }
}
