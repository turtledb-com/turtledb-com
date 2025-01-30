import { cryptoPromise, hashNameAndPassword } from '../utils/crypto.js'
import { getPublicKey, signAsync, verify } from '../utils/noble-secp256k1.js'
import { codec, COMMIT } from './codecs/codec.js'
import { AS_REFS } from './codecs/CodecType.js'
import { Commit } from './codecs/Commit.js'
import { b36ToUint8Array, combineUint8Arrays, uint8ArrayToB36 } from './utils.js'

/**
 * @typedef KeyPair
 * @property {string} privateKey
 * @property {string} publicKey
 */

export class Signer {
  /** @type {Object.<string, KeyPair>} */
  keysByName = {}

  constructor (username, password) {
    this.username = username
    this.hashwordPromise = hashNameAndPassword(username, password)
  }

  /**
   * @param {string} turtlename
   * @returns {KeyPair}
   */
  async makeKeysFor (turtlename) {
    if (!(this.keysByName[turtlename])) {
      const hashword = await this.hashwordPromise
      const privateKey = await hashNameAndPassword(turtlename, hashword)
      const publicKey = uint8ArrayToB36(getPublicKey(privateKey))
      this.keysByName[turtlename] = { privateKey, publicKey }
    }
    return this.keysByName[turtlename]
  }

  /**
   * @param {string} turtleName
   * @param {Uint8Array} uint8Array
   * @returns {Uint8Array}
   */
  async sign (turtleName, uint8Array) {
    const { privateKey } = await this.makeKeysFor(turtleName)
    const hash = await digestData(uint8Array)
    const signature = await signAsync(hash, privateKey)
    return signature.toCompactRawBytes()
  }

  /**
   * @param {import('./TurtleBranch.js').TurtleBranch} target
   * @param {import('./TurtleBranch.js').TurtleBranch} updates
   * @param {number} address
   * @param {string} [publicKey=target.name]
   */
  async commit (target, updates, address, name = target.name) {
    if (target.u8aTurtle !== updates.u8aTurtle.findParentByIndex(target.index)) {
      throw new Error('target must be ancestor of updates (merge required)')
    }
    let uint8Array = combineUint8Arrays(updates.u8aTurtle.exportUint8Arrays(target.index))
    if (target.u8aTurtle) {
      /** @type {Commit} */
      const previousCommit = target.lookup(AS_REFS)
      if (!(previousCommit instanceof Commit)) {
        throw new Error('previous last value must be a Commit')
      }
      if (previousCommit.value === address) {
        throw new Error('duplicate commit (probably a bug...-f?)')
      }
      uint8Array = combineUint8Arrays([previousCommit.signature, uint8Array])
    }
    const signature = await this.sign(name, uint8Array)
    const commit = new Commit(address, signature)
    const encodedCommit = codec.encodeValue(commit, [codec.getCodecType(COMMIT)], null, AS_REFS)
    target.append(combineUint8Arrays([uint8Array, encodedCommit.uint8Array]))
    updates.u8aTurtle = target.u8aTurtle
  }
}

/**
 * @param {import('./U8aTurtle.js').U8aTurtle} u8aTurtle
 * @param {string} publicKey
 */
export async function verifyTurtleCommit (u8aTurtle, publicKey) {
  const footer = u8aTurtle.getByte()
  const codecVersion = codec.getCodecTypeVersion(footer)
  if (codecVersion.codecType !== codec.getCodecType(COMMIT)) {
    throw new Error('last value must be Commit')
  }
  /** @type {Commit} */
  const commit = codecVersion.decode(u8aTurtle, undefined, AS_REFS)
  let uint8Array = u8aTurtle.slice(0, -codecVersion.getWidth(u8aTurtle) - 1)
  if (u8aTurtle.parent) {
    const parentCommit = u8aTurtle.parent.lookup(AS_REFS)
    uint8Array = combineUint8Arrays([parentCommit.signature, uint8Array])
  }
  const hash = await digestData(uint8Array)
  return verify(commit.signature, hash, b36ToUint8Array(publicKey))
}

const digestData = async uint8Array => {
  const { subtle } = await cryptoPromise
  const digested = await subtle.digest('SHA-256', uint8Array)
  return new Uint8Array(digested)
}
