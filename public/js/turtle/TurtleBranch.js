import { Recaller } from '../utils/Recaller.js'
import { squashTurtle, U8aTurtle } from './U8aTurtle.js'
import { combineUint8ArrayLikes, combineUint8Arrays } from './utils.js'

export class TurtleBranch {
  /** @type {U8aTurtle} */
  #u8aTurtle
  /** @type {Set.<ReadableStreamController>} */
  #readableByteStreamControllers = new Set()
  /**
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

  /** @type {U8aTurtle} */
  get u8aTurtle () {
    this.recaller.reportKeyAccess(this, 'u8aTurtle', 'get', this.name)
    return this.#u8aTurtle
  }

  set u8aTurtle (u8aTurtle) {
    if (u8aTurtle === this.#u8aTurtle) return
    if (u8aTurtle.hasAncestor(this.#u8aTurtle)) {
      const uint8Arrays = u8aTurtle.exportUint8Arrays((this.index ?? -1) + 1)
      uint8Arrays.forEach(uint8Array => this.#broadcast(uint8Array))
    } else {
      console.log(this.#u8aTurtle, '->', u8aTurtle)
      console.warn(`TurtleBranch, ${this.name}.u8aTurtle set to non-descendant (any ReadableStreams are broken now)`)
    }
    this.recaller.reportKeyMutation(this, 'u8aTurtle', 'set', this.name)
    this.#u8aTurtle = u8aTurtle
  }

  append (uint8Array) {
    if (!uint8Array?.length) {
      throw new Error('bad Uint8Array')
    }
    this.u8aTurtle = new U8aTurtle(uint8Array, this.u8aTurtle)
    return this.length - 1
  }

  #broadcast (uint8Array) {
    const controllers = this.#readableByteStreamControllers
    const encodedLength = new Uint32Array([uint8Array.length])
    const encodedUint8Array = combineUint8ArrayLikes([encodedLength, uint8Array])
    controllers.forEach(controller => {
      console.log(` >>>> sending ${this.name} 4 + ${uint8Array.length} bytes`)
      controller.enqueue(encodedUint8Array)
    })
  }

  /**
   * @returns {ReadableStream}
   */
  makeReadableStream () {
    const uint8Arrays = this.u8aTurtle?.exportUint8Arrays?.() ?? []
    const controllers = this.#readableByteStreamControllers
    let _controller
    return new ReadableStream({
      start (controller) {
        _controller = controller
        controllers.add(_controller)
        uint8Arrays.forEach(uint8Array => {
          _controller.enqueue(uint8Array)
        })
      },
      cancel (reason) {
        console.log('stream cancelled', { reason })
        controllers.delete(_controller)
      },
      type: 'bytes'
    })
  }

  /**
   * @returns {WritableStream}
   */
  makeWritableStream () {
    let inProgress = new Uint8Array()
    let totalLength
    const turtleBranch = this
    return new WritableStream({
      write (chunk) {
        // console.log(turtleBranch.name, chunk)
        inProgress = combineUint8Arrays([inProgress, chunk])
        if (inProgress.length < 4) return
        totalLength = new Uint32Array(inProgress.slice(0, 4).buffer)[0]
        if (inProgress.length < totalLength + 4) return
        turtleBranch.append(inProgress.slice(4, totalLength + 4))
        inProgress = inProgress.slice(totalLength + 4)
      }
    })
  }

  get length () { return this.u8aTurtle?.length }
  get index () { return this.u8aTurtle?.index }
  getByte (address) { return this.u8aTurtle?.getAncestorByAddress?.(address)?.getByte?.(address) }
  slice (start, end) { return this.u8aTurtle?.getAncestorByAddress?.(start)?.slice?.(start, end) }
  squash (downToIndex) {
    if (this.index === downToIndex) return
    this.#u8aTurtle = squashTurtle(this.u8aTurtle, downToIndex)
    this.recaller.reportKeyMutation(this, 'u8aTurtle', 'squash', this.name)
  }

  /**
   * @param  {[optional_address:number, ...path:Array.<string>, optional_options:import('./codecs/CodecType.js').CodecOptions]} path
   * @returns {any}
   */
  lookup (...path) { return this.u8aTurtle?.lookup?.(...path) }
}
