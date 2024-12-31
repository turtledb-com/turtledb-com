import { codecsByName, codecVersionByFooter, TREE_NODE } from './internal.js'

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
   * @param {import('../U8aTurtle.js').U8aTurtle} u8aTurtle
   */
  * inOrder (u8aTurtle) {
    const leftTurtle = u8aTurtle.findParentByAddress(this.leftAddress)
    const leftFooter = leftTurtle.getByte(this.leftAddress)
    if (codecVersionByFooter[leftFooter].codec === codecsByName[TREE_NODE]) {
      const left = leftTurtle.lookup(this.leftAddress)
      yield * left.inOrder(leftTurtle)
    } else {
      yield this.leftAddress
    }
    const rightTurtle = u8aTurtle.findParentByAddress(this.rightAddress)
    const rightFooter = rightTurtle.getByte(this.rightAddress)
    if (codecVersionByFooter[rightFooter].codec === codecsByName[TREE_NODE]) {
      const right = rightTurtle.lookup(this.rightAddress)
      yield * right.inOrder(rightTurtle)
    } else {
      yield this.rightAddress
    }
  }
}
