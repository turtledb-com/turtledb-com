import { GetObjectCommand, HeadObjectCommand, NotFound, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

/**
 * @typedef {import('./Peer.js').BranchUpdate} BranchUpdate
 * @typedef {import('./Peer.js').Connection} Connection
 * @typedef {import('./Peer.js').Peer} Peer
 * @typedef {import('./Peer.js').Duplex} Duplex
 */

const toKey = (prefix, index) => `${prefix}/${index.toString(36).padStart(8, '0')}`

/**
 * @implements {Connection}
 */
export class ConnectionS3 {
  #s3DataByPrefix = {}
  constructor (name, peer, endpoint, region, bucket, accessKeyId, secretAccessKey) {
    this.name = name
    this.peer = peer
    this.bucket = bucket
    this.s3Client = new S3Client({
      endpoint,
      forcePathStyle: false,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    })
  }

  sync () {
    for (const hostname in this.peer.branches) {
      for (const bale in this.peer.branches[hostname]) {
        for (const cpk in this.peer.branches[hostname][bale]) {
          this.#update(hostname, bale, cpk)
        }
      }
    }
  }

  async #update (hostname, bale, cpk) {
    const prefix = `${hostname}/${bale}/${cpk}`
    /** @type {import('../TurtleBranch.js').TurtleBranch} */
    const branch = this.peer.branches[hostname][bale][cpk]
    const branchIndex = branch.index
    this.#s3DataByPrefix[prefix] ??= {}
    this.#s3DataByPrefix[prefix].index ??= this.#getS3BranchIndex(prefix)
    const s3Index = await this.#s3DataByPrefix[prefix].index
    if (s3Index < branchIndex) {
      this.#s3DataByPrefix[prefix].uploads ??= []
      for (let i = s3Index + 1; i <= branchIndex; ++i) {
        this.#s3DataByPrefix[prefix].uploads[i] ??= this.#putCommit(prefix, i, branch)
      }
      this.#s3DataByPrefix[prefix].index = branchIndex
    } else if (s3Index > (branchIndex ?? -1)) {
      this.#s3DataByPrefix[prefix].downloads ??= []
      for (let i = (branchIndex ?? -1) + 1; i <= s3Index; ++i) {
        this.#s3DataByPrefix[prefix].downloads[i] ??= this.#getCommit(prefix, i, branch)
      }
    }
  }

  /**
   * @param {string} prefix
   * @param {number} index
   * @param {import('../TurtleBranch.js').TurtleBranch} branch
   */
  async #getCommit (prefix, index, branch) {
    const key = toKey(prefix, index)
    const output = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    }))
    const commit = await output.Body.transformToByteArray()
    if (index && branch.index !== index - 1) {
      await this.#s3DataByPrefix[prefix].downloads[index - 1]
      if (branch.index !== index - 1) throw new Error('bad branch index')
    }
    branch.append(commit)
    console.log('#getCommit', prefix, index)
  }

  /**
   * @param {string} prefix
   * @param {number} index
   * @param {import('../TurtleBranch.js').TurtleBranch} branch
   */
  async #putCommit (prefix, index, branch) {
    const key = toKey(prefix, index)
    const commit = branch.u8aTurtle.findParentByIndex(index).uint8Array
    await this.s3Client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: commit }))
    console.log('#putCommit', prefix, index)
  }

  async #getS3BranchIndex (prefix) {
    let lengthGuess = 0
    if (await this.#commitExists(toKey(prefix, 0))) {
      let p = 0
      while (await this.#commitExists(toKey(prefix, 2 ** p))) ++p
      if (p < 2) {
        lengthGuess = 2 ** p
      } else {
        lengthGuess = 2 ** (p - 1)
        let direction = 1
        for (let q = p - 2; q >= 0; --q) {
          lengthGuess += direction * 2 ** q
          direction = await this.#commitExists(toKey(prefix, lengthGuess)) ? 1 : -1
        }
        if (direction === 1) ++lengthGuess
      }
    }
    return lengthGuess - 1
  }

  async #commitExists (key) {
    try {
      await this.s3Client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (error) {
      if (error instanceof NotFound) return false
      throw error
    }
    return true
  }
}
