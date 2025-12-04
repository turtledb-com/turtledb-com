import { Recaller } from '../utils/Recaller.js'
import { squashTurtle, U8aTurtle } from './U8aTurtle.js'
import { combineUint8Arrays } from '../utils/combineUint8Arrays.js'
import { combineUint8ArrayLikes } from '../utils/combineUint8ArrayLikes.js'
import { logInfo, logWarn } from '../utils/logger.js'
import { JSON_FILE, pathToType, TEXT_FILE } from '../utils/fileTransformer.js'

/**
 * @typedef {import('./codecs/CodecType.js').CodecOptions} CodecOptions
 */

const _encodeUint8Array = uint8Array => {
  const encodedLength = new Uint32Array([uint8Array.length])
  return combineUint8ArrayLikes([encodedLength, uint8Array])
}

export class TurtleBranch {
  /** @type {U8aTurtle} */
  #u8aTurtle
  #resolveNextUint8Array
  #setNextUint8Array = uint8Array => {
    const prevResolve = this.#resolveNextUint8Array
    this.nextUint8Array = new Promise(resolve => { this.#resolveNextUint8Array = resolve })
    prevResolve?.(uint8Array)
  }

  /**
   * @param {string} name
   * @param {Recaller} recaller
   * @param {U8aTurtle} u8aTurtle
   */
  constructor (name, recaller = new Recaller(name), u8aTurtle) {
    if (!name) throw new Error('please name your branches')
    this.name = name
    this.recaller = recaller
    this.#u8aTurtle = u8aTurtle
    this.nextUint8Array = new Promise(resolve => { this.#resolveNextUint8Array = resolve })
  }

  /** @type {U8aTurtle} */
  get u8aTurtle () {
    this.recaller.reportKeyAccess(this, 'u8aTurtle', 'get', this.name)
    return this.#u8aTurtle
  }

  set u8aTurtle (u8aTurtle) {
    if (u8aTurtle === this.#u8aTurtle) return
    if (u8aTurtle !== undefined) {
      if (u8aTurtle.hasAncestor(this.#u8aTurtle)) {
        const uint8Arrays = u8aTurtle.exportUint8Arrays((this.index ?? -1) + 1)
        uint8Arrays.forEach(uint8Array => {
          this.#setNextUint8Array(uint8Array)
        })
      } else {
        logWarn(() => console.warn(`TurtleBranch, ${this.name}.u8aTurtle set to non-descendant (generators are broken now)`))
      }
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

  async * u8aTurtleGenerator () {
    let lastIndex = -1
    while (true) {
      while (lastIndex < this.index) {
        ++lastIndex
        yield this.u8aTurtle.getAncestorByIndex(lastIndex)
      }
      await this.nextUint8Array
    }
  }

  /**
   * @returns {ReadableStream}
   */
  makeReadableStream () {
    let _controller
    const turtleBranch = this
    return new ReadableStream({
      async start (controller) {
        _controller = controller
        for await (const u8aTurtle of turtleBranch.u8aTurtleGenerator()) {
          _controller.enqueue(_encodeUint8Array(u8aTurtle.uint8Array))
        }
      },
      cancel (reason) {
        logInfo(() => console.log('stream cancelled', { reason }))
      },
      type: 'bytes'
    })
  }

  /**
   * @returns {WritableStream}
   */
  makeWritableStream () {
    let u8aProgress = new Uint8Array()
    let u8aLength
    const turtleBranch = this
    return new WritableStream({
      write (chunk) {
        u8aProgress = combineUint8Arrays([u8aProgress, chunk])
        while (u8aProgress.length > 4 && u8aProgress.length > (u8aLength = new Uint32Array(u8aProgress.slice(0, 4).buffer)[0])) {
          const uint8Array = u8aProgress.slice(4, u8aLength + 4)
          turtleBranch.append(uint8Array)
          u8aProgress = u8aProgress.slice(u8aLength + 4)
        }
      }
    })
  }

  get length () { return this.u8aTurtle?.length ?? 0 }
  get index () { return this.u8aTurtle?.index ?? -1 }
  getByte (address) { return this.u8aTurtle?.getAncestorByAddress?.(address)?.getByte?.(address) }
  slice (start, end) { return this.u8aTurtle?.getAncestorByAddress?.(start)?.slice?.(start, end) }
  squash (downToIndex) {
    if (this.index === downToIndex) return
    this.#u8aTurtle = squashTurtle(this.u8aTurtle, downToIndex)
    this.recaller.reportKeyMutation(this, 'u8aTurtle', 'squash', this.name)
  }

  /**
   * @param  {[optional_address:number, ...path:Array.<string>, optional_options:CodecOptions]} path
   * @returns {any}
   */
  lookup (...path) { return this.u8aTurtle?.lookup?.(...path) }

  lookupFile (filename, asStored = false, address) {
    const type = pathToType(filename)
    const storedContent = address ? this.lookup(address) : this.lookup('document', 'value', filename)
    if (asStored || !storedContent) return storedContent
    if (storedContent?.symlink) return storedContent
    if (storedContent instanceof Uint8Array) return storedContent
    if (typeof storedContent === 'string') return storedContent
    if (type === JSON_FILE) return JSON.stringify(storedContent, null, 2)
    if (type === TEXT_FILE) return storedContent.join('\n')
    return undefined
  }
}
