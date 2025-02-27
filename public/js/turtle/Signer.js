import { cryptoPromise, hashNameAndPassword } from '../utils/crypto.js'
import { getPublicKey, signAsync, verify } from '../utils/noble-secp256k1.js'
import { codec, COMMIT } from './codecs/codec.js'
import { AS_REFS } from './codecs/CodecType.js'
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
}

/**
 * @param {import('./U8aTurtle.js').U8aTurtle} u8aTurtle
 * @param {string} publicKey
 */
export async function verifyTurtleCommit (u8aTurtle, publicKey) {
  const footer = u8aTurtle.getByte()
  const codecVersion = codec.getCodecTypeVersion(footer)
  if (codecVersion.codecType !== COMMIT) {
    throw new Error('last value must be Commit')
  }
  /** @type {import('./codecs/Commit.js').Commit} */
  const commit = codecVersion.decode(u8aTurtle, undefined, AS_REFS)
  console.log(commit, codecVersion.getWidth(u8aTurtle))
  let uint8Array = u8aTurtle.slice(undefined, -codecVersion.getWidth(u8aTurtle) - 1)
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
