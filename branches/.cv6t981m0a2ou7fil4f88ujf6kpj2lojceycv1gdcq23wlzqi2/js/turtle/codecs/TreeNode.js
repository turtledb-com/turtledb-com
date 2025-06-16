import { codec, TREE_NODE } from './codec.js'

/**
 * @typedef {import('../U8aTurtle.js').U8aTurtle} U8aTurtle
 */

export class TreeNode {
  /**
   * @param {number} leftAddress
   * @param {number} rightAddress
   */
  constructor (leftAddress, rightAddress) {
    this.leftAddress = leftAddress
    this.rightAddress = rightAddress
  }

  /**
   * @param {U8aTurtle} u8aTurtle
   */
  * inOrder (u8aTurtle) {
    const leftTurtle = u8aTurtle.getAncestorByAddress(this.leftAddress)
    const leftFooter = leftTurtle.getByte(this.leftAddress)
    if (codec.getCodecTypeVersion(leftFooter).codecType === TREE_NODE) {
      const left = leftTurtle.lookup(this.leftAddress)
      yield * left.inOrder(leftTurtle)
    } else {
      yield this.leftAddress
    }
    const rightTurtle = u8aTurtle.getAncestorByAddress(this.rightAddress)
    const rightFooter = rightTurtle.getByte(this.rightAddress)
    if (codec.getCodecTypeVersion(rightFooter).codecType === TREE_NODE) {
      const right = rightTurtle.lookup(this.rightAddress)
      yield * right.inOrder(rightTurtle)
    } else {
      yield this.rightAddress
    }
  }
}
