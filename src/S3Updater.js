import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import { AbstractUpdater } from '../public/js/turtle/connections/AbstractUpdater.js'
import { verifyCommitU8a } from '../public/js/turtle/Signer.js'
import { getExistenceLength } from './getExistenceLength.js'
import { logSilly } from '../public/js/utils/logger.js'

/**
 * @typedef {import('@aws-sdk/client-s3').S3Client} S3Client
 * @typedef {import('../public/js/utils/Recaller.js').Recaller} Recaller
 */

export class S3Updater extends AbstractUpdater {
  #length
  #lengthPromise
  #getPromises = []
  /**
   * @param {string} name
   * @param {string} publicKey
   * @param {Recaller} recaller
   * @param {S3Client} s3Client
   * @param {string} bucket
   */
  constructor (name, publicKey, recaller, s3Client, bucket) {
    super(name, publicKey, true, recaller)
    this.s3Client = s3Client
    this.bucket = bucket
    this.indexToKey = S3Updater.indexToKey
    this.checkBase = this.s3Client.send(new HeadObjectCommand({
      Bucket: this.bucket,
      Key: this.indexToKey(this.publicKey, 32)
    })).then(() => {
      // not base32
    }).catch(() => {
      return this.s3Client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.indexToKey(this.publicKey, 36)
      })).then(() => {
        this.indexToKey = S3Updater.indexToKey32
      }).catch(() => {
        // less than 32 so it's fine
      })
    })
    logSilly(() => console.log('S3Updater still has checkBase:', !!this.checkBase))
  }

  /**
   * @returns {Promise.<number>}
   */
  async getUint8ArraysLength () {
    await this.checkBase
    if (this.#length !== undefined) return this.#length
    const getExists = async index => {
      const listObjectsV2Response = await this.s3Client.send(new ListObjectsV2Command({
        ...(index ? { StartAfter: this.indexToKey(this.publicKey, index - 1) } : {}),
        MaxKeys: 1,
        Bucket: this.bucket,
        Prefix: this.publicKey
      }))
      return !!listObjectsV2Response.KeyCount
    }
    if (this.#lengthPromise === undefined) {
      this.#lengthPromise = getExistenceLength(getExists)
      this.#lengthPromise.then(length => { this.#length = length })
    }
    return this.#lengthPromise
  }

  /**
   * @param {number} index
   * @returns {Promise.<Uint8Array>}
   */
  async getUint8Array (index) {
    await this.getUint8ArraysLength()
    if (index >= this.#length) return
    for (let i = index; i < this.#length; ++i) {
      if (this.#getPromises[i]) break
      let resolve, reject
      this.#getPromises[i] = new Promise((...args) => { [resolve, reject] = args })
      try {
        const object = await this.s3Client.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.indexToKey(this.publicKey, i)
        }))
        object.Body.transformToByteArray().then(resolve)
      } catch (error) { reject(error) }
    }
    return this.#getPromises[index]
  }

  /**
   * @param {Uint8Array} uint8Array
   * @returns {Promise.<number>}
   */
  async pushUint8Array (uint8Array) {
    await this.getUint8ArraysLength()
    if (!this.#getPromises[this.#length]) {
      let resolve, reject
      this.#getPromises[this.#length] = new Promise((...args) => { [resolve, reject] = args })
      let previousUint8Array
      if (this.#length > 0) {
        previousUint8Array = await this.getUint8Array(this.#length - 1)
      }
      const verified = await verifyCommitU8a(this.publicKey, uint8Array, previousUint8Array)
      if (!verified) throw new Error('bad signature')
      try {
        await this.s3Client.send(new PutObjectCommand({
          Bucket: this.bucket,
          Body: uint8Array,
          Key: this.indexToKey(this.publicKey, this.#length)
        }))
        ++this.#length
        resolve(uint8Array)
      } catch (error) { reject(error) }
    }
    return this.#getPromises[this.#length]
  }

  /**
   * @param {string} publicKey
   * @param {number} index
   * @returns {string}
   */
  static indexToKey = (publicKey, index) => `${publicKey}/${index.toString(36).padStart(6, '0')}`
  static indexToKey32 = (publicKey, index) => `${publicKey}/${index.toString(32).padStart(6, '0')}`
}
