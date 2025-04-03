export class Commit {
  /**
   * @param {Object} document
   * @param {Uint8Array} signature
   */
  constructor (document, signature) {
    this.document = document
    this.signature = signature
  }
}
