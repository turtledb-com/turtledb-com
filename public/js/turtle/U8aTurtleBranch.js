import { Recaller } from '../utils/Recaller.js'
import { squashTurtle, U8aTurtle } from './U8aTurtle.js'

export class U8aTurtleBranch {
  #u8aTurtle
  /**
   *
   * @param {string} name
   * @param {Recaller} recaller
   * @param {import('./U8aTurtle.js').U8aTurtle} u8aTurtle
   */
  constructor (name, recaller = new Recaller(name), u8aTurtle) {
    if (!name) throw new Error('please name your branches')
    this.name = name
    this.recaller = recaller
    this.#u8aTurtle = u8aTurtle
  }

  get u8aTurtle () {
    this.recaller.reportKeyAccess(this, 'u8aTurtle', 'get', this.name)
    return this.#u8aTurtle
  }

  set u8aTurtle (u8aTurtle) {
    this.recaller.reportKeyMutation(this, 'u8aTurtle', 'set', this.name)
    this.#u8aTurtle = u8aTurtle
  }

  get length () { return this.u8aTurtle?.length }
  get height () { return this.u8aTurtle?.height }
  getByte (address) { return this.u8aTurtle?.findParentByAddress?.(address)?.getByte?.(address) }
  slice (start, end) { return this.u8aTurtle?.findParentByAddress?.(start)?.slice?.(start, end) }
  squash (downToHeight) { this.u8aTurtle = squashTurtle(this.u8aTurtle, downToHeight) }
  append (uint8Array) { this.u8aTurtle = new U8aTurtle(uint8Array, this.u8aTurtle) }
  lookup (address) { return this.u8aTurtle?.lookup?.(address) }
}
