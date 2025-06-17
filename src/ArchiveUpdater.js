import { join } from 'path'
import { AbstractUpdater } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/AbstractUpdater.js'
import { getExistenceLength } from './getExistenceLength.js'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { verifyCommitU8a } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Signer.js'

/**
 * @typedef {import('@aws-sdk/client-s3').S3Client} S3Client
 * @typedef {import('../branches/public/js/utils/Recaller.js').Recaller} Recaller
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
    super(name, publicKey, false, recaller)
    this.path = path
  }

  indexToPath (index) {
    if (index === undefined) return join(this.path, this.publicKey)
    return join(this.path, this.publicKey, index.toString(32).padStart(6, '0'))
  }

  async setUint8ArraysLength (length) {
    const conflictMessage = `Attempt to setUint8ArrayLength(${length}) of "${this.name}" (conflict at ${length.toString(32).padStart(6, '0')}). Backup and delete archive/${this.publicKey} to resolve.`
    throw new Error(conflictMessage)
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
    if (!this.#lengthPromise) {
      const path = join(this.path, this.publicKey)
      this.#lengthPromise = (async () => {
        if (!(await getExists())) {
          await mkdir(path, { recursive: true })
        }
        this.#length = await getExistenceLength(getExists)
        return this.#length
      })()
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
        await writeFile(this.indexToPath(this.#length), uint8Array, 'binary')
        ++this.#length
        return uint8Array
      })()
    }
    return this.#getPromises[this.#length]
  }
}
