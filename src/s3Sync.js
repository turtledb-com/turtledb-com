import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { AbstractUpdater } from '../public/js/turtle/connections/AbstractUpdater.js'
import { TurtleBranchMultiplexer } from '../public/js/turtle/connections/TurtleBranchMultiplexer.js'
import { verifyCommitU8a } from '../public/js/turtle/Signer.js'

/**
 * @typedef {import('@aws-sdk/client-s3').S3Client} S3Client
 * @typedef {import('../public/js/turtle/TurtleBranch').TurtleBranch} TurtleBranch
 * @typedef {import('../public/js/utils/Recaller').Recaller} Recaller
 */

/**
 * @param {Object.<string, TurtleBranch>} turtleRegistry
 * @param {Recaller} recaller
 */
export async function s3Sync (turtleRegistry, recaller, endpoint, region, accessKeyId, secretAccessKey, bucket) {
  /** @type {import('@aws-sdk/client-s3').S3ClientConfig} */
  const s3ClientConfig = {
    endpoint,
    forcePathStyle: false,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  }
  const s3Client = new S3Client(s3ClientConfig)
  const s3Mux = new S3Multiplexer('s3Sync', s3Client, bucket, recaller)
  recaller.watch('s3', () => {
    for (const publicKey in turtleRegistry) {
      const turtleBranch = turtleRegistry[publicKey]
      console.log('s3 watching', turtleBranch)
      const s3Updater = s3Mux.getTurtleBranchUpdater(publicKey, publicKey)
      s3Updater.start()
    }
  })
}

export class S3Multiplexer extends TurtleBranchMultiplexer {
  /** @type {Object.<string, S3Updater>} */
  #updatersByCpk = {}

  /**
   * @param {string} name
   * @param {S3Client} s3Client
   * @param {string} bucket
   * @param {Recaller} recaller
   */
  constructor (name, s3Client, bucket, recaller) {
    super(name, true, recaller)
    this.s3Client = s3Client
    this.bucket = bucket
  }

  /**
   * @param {string} name
   * @param {string} publicKey
   */
  getTurtleBranchUpdater (name = '', publicKey = '') {
    if (!this.#updatersByCpk[publicKey]) {
      const updater = new S3Updater(name, publicKey, this.recaller, this.s3Client, this.bucket)
      let lastIndex = -1
      updater.outgoingBranch.recaller.watch(`S3Mux"${this.name}(${publicKey} ${name})`, () => {
        while (lastIndex < updater.outgoingBranch.index) {
          ++lastIndex
          const u8aTurtle = updater.outgoingBranch.u8aTurtle.getAncestorByIndex(lastIndex)
          this.sendUpdate(u8aTurtle.uint8Array, name, publicKey)
        }
      })
      this.#updatersByCpk[publicKey] = updater
    }
    this.#updatersByCpk[publicKey].start()
    return this.#updatersByCpk[publicKey]
  }
}

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
  }

  async getUint8ArraysLength () {
    if (this.#length !== undefined) return this.#length
    const getExists = async index => {
      const listObjectsV2Response = await this.s3Client.send(new ListObjectsV2Command({
        ...(index ? { StartAfter: S3Updater.indexToKey(this.publicKey, index - 1) } : {}),
        MaxKeys: 1,
        Bucket: this.bucket,
        Prefix: this.publicKey
      }))
      return !!listObjectsV2Response.KeyCount
    }
    if (this.#lengthPromise === undefined) {
      let resolve, reject
      this.#lengthPromise = new Promise((...args) => { [resolve, reject] = args })
      let lengthGuess = 0
      try {
        if (await getExists(0)) {
          let p = 0
          while (await getExists(2 ** p)) ++p
          if (p < 2) {
            lengthGuess = 2 ** p
          } else {
            lengthGuess = 2 ** (p - 1)
            let direction = 1
            for (let q = p - 2; q >= 0; --q) {
              lengthGuess += direction * 2 ** q
              direction = await getExists(lengthGuess) ? 1 : -1
            }
            if (direction === 1) ++lengthGuess
          }
        }
        this.#length = lengthGuess
        resolve(this.#length)
      } catch (error) { reject(error) }
    }
    return this.#lengthPromise
  }

  async getUint8Array (index) {
    await this.getUint8ArraysLength()
    if (index >= this.#length) return
    if (!this.#getPromises[index]) {
      let resolve, reject
      this.#getPromises[index] = new Promise((...args) => { [resolve, reject] = args })
      try {
        const object = await this.s3Client.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: S3Updater.indexToKey(this.publicKey, index)
        }))
        const uint8Array = await object.Body.transformToByteArray()
        resolve(uint8Array)
      } catch (error) { reject(error) }
    }
    return this.#getPromises[index]
  }

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
          Key: S3Updater.indexToKey(this.publicKey, this.#length)
        }))
        ++this.#length
        resolve(uint8Array)
      } catch (error) { reject(error) }
    }
    return this.#getPromises[this.#length]
  }

  static indexToKey = (compactPublicKey, index) => `${compactPublicKey}/${`000000${index.toString(32)}`.slice(-6)}`
}
