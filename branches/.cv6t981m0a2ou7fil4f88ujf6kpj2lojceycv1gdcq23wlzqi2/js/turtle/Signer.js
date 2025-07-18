import { cryptoPromise, hashNameAndPassword } from '../utils/crypto.js'
import { getPublicKey, signAsync, verify } from '../utils/noble-secp256k1.js'
import { codec, COMMIT, splitEncodedCommit } from './codecs/codec.js'
import { AS_REFS } from './codecs/CodecType.js'
import { Commit } from './codecs/Commit.js'
import { b36ToUint8Array, uint8ArrayToB36 } from './utils.js'
import { combineUint8Arrays } from '../utils/combineUint8Arrays.js'
import { U8aTurtle } from './U8aTurtle.js'
import { logError } from '../utils/logger.js'

/**
 * @typedef {import('./U8aTurtle.js').U8aTurtle} U8aTurtle
 * @typedef {import('./codecs/Commit.js').Commit} Commit
 */

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
   * @param {string} turtlename
   * @param {number} commitAddress
   * @param {U8aTurtle} u8aTurtle
   * @param {U8aTurtle} committedTurtle
   * @return {Uint8Array}
   */
  async signCommit (turtlename, commitAddress, u8aTurtle, committedTurtle) {
    const uint8Arrays = u8aTurtle.exportUint8Arrays((committedTurtle?.index ?? -1) + 1)
    if (committedTurtle) {
      const previousEncodedCommit = splitEncodedCommit(committedTurtle)[1]
      uint8Arrays.unshift(previousEncodedCommit)
    }
    const signature = await this.sign(turtlename, combineUint8Arrays(uint8Arrays))
    const commit = new Commit(commitAddress, signature)
    return COMMIT.encode(commit, undefined, AS_REFS)
  }
}

/**
 * @param {U8aTurtle} u8aTurtle
 * @param {string} publicKey
 */
export async function verifyTurtleCommit (u8aTurtle, publicKey) {
  try {
    const footer = u8aTurtle.getByte()
    const codecVersion = codec.getCodecTypeVersion(footer)
    if (codecVersion.codecType !== COMMIT) {
      throw new Error('last value must be Commit')
    }
    /** @type {Commit} */
    const commit = codecVersion.decode(u8aTurtle, undefined, AS_REFS)
    let uint8Array = u8aTurtle.slice(undefined, -codecVersion.getWidth(u8aTurtle) - 1)
    if (u8aTurtle.parent) {
      const previousEncodedCommit = splitEncodedCommit(u8aTurtle.parent)[1]
      uint8Array = combineUint8Arrays([previousEncodedCommit, uint8Array])
    }
    const hash = await digestData(uint8Array)
    return verify(commit.signature, hash, b36ToUint8Array(publicKey))
  } catch (error) {
    logError(() => console.error(error))
    return false
  }
}

/**
 *
 * @param {string} publicKey
 * @param {Uint8Array} uint8Array
 * @param {Uint8Array} [previousUint8Array]
 */
export function verifyCommitU8a (publicKey, uint8Array, previousUint8Array) {
  const u8aTurtle = new U8aTurtle(
    uint8Array,
    previousUint8Array && new U8aTurtle(previousUint8Array)
  )
  return verifyTurtleCommit(u8aTurtle, publicKey)
}

const digestData = async uint8Array => {
  const { subtle } = await cryptoPromise
  const digested = await subtle.digest('SHA-256', uint8Array)
  return new Uint8Array(digested)
}
