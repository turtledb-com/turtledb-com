import { join } from 'path'
import { AbstractUpdater } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/AbstractUpdater.js'
import { getExistenceLength } from './getExistenceLength.js'
import { access, readFile, writeFile } from 'fs/promises'
import { verifyCommitU8a } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Signer.js'

/**
 * @typedef {import('@aws-sdk/client-s3').S3Client} S3Client
 * @typedef {import('../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/Recaller.js').Recaller} Recaller
 */

export class ArchiveUpdater extends AbstractUpdater {
  #length
  #lengthPromise
  #getPromises = []

  /**
   * @param {string} name
   * @param {string} publicKey
   * @param {Recaller} recaller
   * @param {string} path
   */
  constructor (name, publicKey, recaller, path) {
    super(name, publicKey, true, recaller)
    this.path = path
  }

  indexToPath (index) {
    return join(this.path, this.publicKey, index.toString(32).padStart(6, '0'))
  }

  /**
   * @returns {Promise.<number>}
   */
  async getUint8ArraysLength () {
    if (this.#length !== undefined) return this.#length
    const getExists = async index => {
      try {
        await access(this.indexToPath(index))
        return true
      } catch {
        return false
      }
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
      this.#getPromises[i] = readFile(this.indexToPath(i))
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
      this.#getPromises[this.#length] = (async () => {
        let previousUint8Array
        if (this.#length > 0) {
          previousUint8Array = await this.getUint8Array(this.#length - 1)
        }
        const verified = await verifyCommitU8a(this.publicKey, uint8Array, previousUint8Array)
        if (!verified) throw new Error('bad signature')
        await writeFile(this.indexToPath(this.#length), uint8Array)
        ++this.#length
        return uint8Array
      })()
      /*
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
          Key: S3Updater.indexToKey(this.publicKey, this.#length)
        }))
        ++this.#length
        resolve(uint8Array)
      } catch (error) { reject(error) }
       */
    }
    return this.#getPromises[this.#length]
  }
}
