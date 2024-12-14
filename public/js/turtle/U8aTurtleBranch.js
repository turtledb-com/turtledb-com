import { Recaller } from '../utils/Recaller.js'
import { combineTurtles, U8aTurtle } from './U8aTurtle.js'

export class U8aTurtleBranch {
  #u8aTurtle
  /**
   *
   * @param {string} name
   * @param {import('./U8aTurtle.js').U8aTurtle} u8aTurtle
   * @param {Recaller} recaller
   */
  constructor (name, u8aTurtle, recaller = new Recaller(name)) {
    this.name = name
    this.#u8aTurtle = u8aTurtle
    this.recaller = recaller
  }

  get u8aTurtle () {
    this.recaller.reportKeyAccess(this, 'u8aTurtle', 'get', this.name)
    return this.#u8aTurtle
  }

  set u8aTurtle (u8aTurtle) {
    this.recaller.reportKeyMutation(this, 'u8aTurtle', 'set', this.name)
    this.#u8aTurtle = u8aTurtle
  }

  get length () { return this.u8aTurtle.length }
  get height () { return this.u8aTurtle.height }
  getByte (address) { return this.u8aTurtle.findParentByAddress(address).getByte(address) }
  slice (start, end) { return this.u8aTurtle.findParentByAddress(start).slice(start, end) }
  squash (downToHeight) { this.u8aTurtle = combineTurtles(this.u8aTurtle, downToHeight) }
  append (uint8Array) { this.u8aTurtle = new U8aTurtle(uint8Array, this.u8aTurtle) }
}
