import { IGNORE, Recaller } from '../../utils/Recaller.js'
import { OPAQUE_UINT8ARRAY } from '../codecs/codec.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { compareUint8Arrays } from '../utils.js'

/**
 * @typedef {{ts: Date, uint8ArrayAddresses: Array.<number>}} TurtleTalk
 */

export class AbstractTurtleTalker {
  #isUpdating = false
  #incomingUint8ArraysByAddress = {}
  #outgoingAddressesByUint8Array = new Map()
  #previousOutgoingAddressesAddress
  /**
   * @param {string} name
   * @param {boolean} [isTrusted=false]
   * @param {Recaller} [recaller=new Recaller(`${name}.recaller`)]
   */
  constructor (
    name,
    isTrusted = false,
    recaller = new Recaller(`${name}.recaller`)
  ) {
    this.name = name
    this.isTrusted = isTrusted
    this.recaller = recaller
    this.outgoingDictionary = new TurtleDictionary(`${name}.outgoingDictionary`, recaller)
    this.outgoingBranch = new TurtleBranch(`${name}.outgoingBranch`, recaller)
    this.incomingBranch = new TurtleBranch(`${name}.incomingBranch`, recaller)
  }

  start () {
    this.recaller.watch(`${this.name}.watcher`, () => this.update())
  }

  /** @param {TurtleBranch} connection */
  connect (connection) {
    this.makeReadableStream().pipeTo(connection.makeWritableStream())
    connection.makeReadableStream().pipeTo(this.makeWritableStream())
  }

  makeReadableStream () { return this.outgoingBranch.makeReadableStream() }
  makeWritableStream () { return this.incomingBranch.makeWritableStream() }

  async getUint8ArraysLength () { throw new Error('class extending AbstractTurtleTalker must implement getUint8ArraysLength') }
  async getUint8Array (index) { throw new Error('class extending AsyncTurtleBranchInterface must implement getUint8Array') }
  async appendUint8Array (uint8Array) { throw new Error('class extending AsyncTurtleBranchInterface must implement appendUint8Array') }

  update = async () => {
    if (this.#isUpdating) return this.recaller.reportKeyAccess(this, '#isUpdating', 'update', this.name) // try again when when it's done updating
    /** @type {TurtleTalk} */
    const incomingTurtleTalk = this.incomingBranch.lookup() // trigger key access reporter before any awaits!
    console.log(`${this.name} incoming[${this.incomingBranch.index}]:`, incomingTurtleTalk)
    let length = await this.getUint8ArraysLength()
    const outgoingTurtleTalk = this.recaller.call(() => this.outgoingBranch.lookup(), IGNORE) ?? { ts: new Date(), uint8ArrayAddresses: [] }
    if (incomingTurtleTalk?.uint8ArrayAddresses) { // they're ready
      this.#isUpdating = true
      // 1st handle incoming message (if any exist)
      for (const index in incomingTurtleTalk.uint8ArrayAddresses) {
        const incomingAddress = incomingTurtleTalk.uint8ArrayAddresses[index]
        const incomingUint8Array = this.incomingBranch.lookup(incomingAddress)
        if (+index < length) { // we should already have this one
          const ourUint8Array = await this.getUint8Array(+index)
          if (this.#incomingUint8ArraysByAddress[incomingAddress] === undefined) {
            if (!compareUint8Arrays(ourUint8Array, incomingUint8Array)) { // collision!
              if (this.isTrusted) incomingTurtleTalk.uint8ArrayAddresses.length = +index
              else length = +index
              break
            } else {
              this.#incomingUint8ArraysByAddress[incomingAddress] = ourUint8Array
            }
          }
        }
        if (length === +index) { // let's add a new one
          console.log('<== check signature here')
          await this.appendUint8Array(incomingUint8Array)
          length = +index + 1
        }
      }
      // send them what they're missing
      for (let index = incomingTurtleTalk.uint8ArrayAddresses.length; index < length; ++index) {
        const uint8Array = await this.getUint8Array(index)
        console.log(index, uint8Array)
        if (this.#outgoingAddressesByUint8Array.get(uint8Array) === undefined) {
          this.#outgoingAddressesByUint8Array.set(uint8Array, this.outgoingDictionary.upsert(uint8Array, [OPAQUE_UINT8ARRAY]))
        }
        outgoingTurtleTalk.uint8ArrayAddresses[index] = this.#outgoingAddressesByUint8Array.get(uint8Array)
      }
    }
    outgoingTurtleTalk.uint8ArrayAddresses.length = length
    const outgoingAddressesAddress = this.outgoingDictionary.upsert(outgoingTurtleTalk.uint8ArrayAddresses)
    if (this.#previousOutgoingAddressesAddress !== outgoingAddressesAddress) {
      this.#previousOutgoingAddressesAddress = outgoingAddressesAddress
      this.outgoingDictionary.upsert(outgoingTurtleTalk)
      this.outgoingDictionary.squash(this.outgoingBranch.index + 1)
      this.outgoingBranch.u8aTurtle = this.outgoingDictionary.u8aTurtle
    }

    this.#isUpdating = false
    this.recaller.reportKeyMutation(this, '#isUpdating', 'update', this.name)

    // // 1st handle any conflicts
    // const uint8ArraysLength = await this.getUint8ArraysLength()
    // const incomingLength = incomingUint8ArrayAddresses?.uint8Arrays?.length
    // if (uint8ArraysLength > 0 && incomingLength > 0) {
    //   /*
    //     for (const index of await this.outgoingBranch.getShownCommits()) {
    //       const i = +index
    //       if (!compareUint8Arrays(await this.outgoingBranch.getHead(i), await this.incomingBranch.getHead(i))) {
    //         console.error('incoming conflict', { i, cpk: this.outgoingBranch.cpk, trusted: this.outgoingBranch.trusted })
    //         if (this.outgoingBranch.trusted) await this.incomingBranch.truncate(i)
    //         else await this.outgoingBranch.truncate(i)
    //         break
    //       }
    //     }
    //     */
    // }
    // // 2nd copy new Commits from this.incomingBranch
    // for (const index of await incomingUint8ArrayAddresses) {
    //   if (+index === this.outgoingBranch.length) {
    //     await this.outgoingBranch.setUint8Array(this.outgoingBranch.length, await this.incomingBranch.getUint8Array(this.outgoingBranch.length))
    //   }
    // }
    // // 3rd write out new Commits for this.incomingBranch
    // for (let index = this.incomingBranch.index + 1; index <= this.outgoingBranch.length - 1; ++index) {
    //   await this.outgoingBranch.showCommitRefs(index)
    // }
    // // 4th send signature for this.incomingBranch current index // shows this.outgoingBranch's interest and lets this.incomingBranch check for conflicts
    // if (this.outgoingBranch.length && this.incomingBranch.index !== -1 && this.outgoingBranch.length > this.incomingBranch.index) {
    //   await this.outgoingBranch.showHeadRef(this.incomingBranch.index)
    // }
  }
}

export class TurtleBranchTurtleTalker extends AbstractTurtleTalker {
  /**
   * @param {string} name
   * @param {TurtleBranch} turtleBranch
   * @param {boolean} [isTrusted=false]
   * @param {Recaller} [recaller=new Recaller(`${name}.recaller`)]
   */
  constructor (name, turtleBranch, isTrusted, recaller = turtleBranch.recaller) {
    super(name, isTrusted, recaller)
    this.turtleBranch = turtleBranch
  }

  async getUint8ArraysLength () { return this.turtleBranch.index + 1 }
  async getUint8Array (index) { return this.turtleBranch.u8aTurtle?.getAncestorByIndex?.(index)?.uint8Array }
  async appendUint8Array (uint8Array) { return this.turtleBranch.append(uint8Array) }
}
