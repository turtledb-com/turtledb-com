import { Recaller } from '../../utils/Recaller.js'
import { findCommonAncestor } from '../U8aTurtle.js'
import { AbstractUpdater } from './AbstractUpdater.js'

/** @typedef {import('../TurtleBranch.js').TurtleBranch} TurtleBranch */

// let i = 0

export class TurtleBranchUpdater extends AbstractUpdater {
  /**
   * @param {string} name
   * @param {TurtleBranch} turtleBranch
   * @param {string} publicKey
   * @param {boolean} [Xours=false]
   * @param {Recaller} [recaller=new Recaller(`${name}.recaller`)]
   */
  constructor (name, turtleBranch, publicKey, Xours, recaller = new Recaller(name)) {
    super(name, publicKey, Xours, recaller)
    this.turtleBranch = turtleBranch
    /** @type {U8aTurtle} */
    let lastU8aTurtle
    this.turtleBranch.recaller.watch(name, () => {
      if (this.turtleBranch.u8aTurtle !== lastU8aTurtle) {
        const incomingUint8ArrayAddresses = this.incomingBranch.lookup()?.uint8ArrayAddresses
        if (incomingUint8ArrayAddresses?.length && !this.turtleBranch.u8aTurtle?.hasAncestor?.(lastU8aTurtle)) {
          const commonAncestor = findCommonAncestor(lastU8aTurtle, this.turtleBranch.u8aTurtle)
          if (commonAncestor) {
            incomingUint8ArrayAddresses.length = Math.min(incomingUint8ArrayAddresses.length, commonAncestor.index + 1)
          } else {
            incomingUint8ArrayAddresses.length = 0
          }
        }
        // console.log('TurtleBranchUpdater', this.name, 'incomingUint8ArrayAddresses', incomingUint8ArrayAddresses)
        this.update(incomingUint8ArrayAddresses)
        // console.log(this.turtleBranch.name, this.turtleBranch.index)
        lastU8aTurtle = this.turtleBranch.u8aTurtle
      }
    })
  }

  get settle () {
    let resolve
    // const j = ++i
    const settlePromise = new Promise((...args) => { [resolve] = args })
    const checkSettle = () => {
      const incoming = this.incomingBranch.lookup()
      // console.log(j, this.publicKey, { incoming }, this.turtleBranch.index)
      // console.log('???????', JSON.stringify(this.name), 'checkSettle index:', this.turtleBranch.index, 'incoming uint8ArrayAddresses:', incoming?.uint8ArrayAddresses)
      if (this.turtleBranch.index + 1 >= incoming?.uint8ArrayAddresses?.length) {
        // console.log('!!!!!!!', JSON.stringify(this.name), 'settled')
        this.incomingBranch.recaller.unwatch(checkSettle)
        resolve()
      }
    }
    this.incomingBranch.recaller.watch(`TBMux"${this.name}".settle`, checkSettle)
    return settlePromise
  }

  async getUint8ArraysLength () { return this.turtleBranch.index + 1 }
  async setUint8ArraysLength (length) { this.turtleBranch.u8aTurtle = length ? this.turtleBranch.u8aTurtle?.getAncestorByIndex?.(length - 1) : undefined }
  async getUint8Array (index) { return this.turtleBranch.u8aTurtle?.getAncestorByIndex?.(index)?.uint8Array }
  async pushUint8Array (uint8Array) { return this.turtleBranch.append(uint8Array) }
  async popUint8Array () { this.turtleBranch.u8aTurtle = this.turtleBranch.u8aTurtle.parent }
}
