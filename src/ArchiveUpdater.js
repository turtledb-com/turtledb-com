import { join } from 'path'
import { AbstractUpdater } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/AbstractUpdater.js'
import { getExistenceLength } from './getExistenceLength.js'
import { promises } from 'fs'
import { access } from 'fs/promises'

/**
 * @typedef {import('@aws-sdk/client-s3').S3Client} S3Client
 * @typedef {import('../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/Recaller.js').Recaller} Recaller
 */

export class ArchiveUpdater extends AbstractUpdater {
  #length
  #lengthPromise
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
}
