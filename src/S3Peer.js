import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import { Committer } from '../public/js/dataModel/Committer.js'
import { Recaller } from '../public/js/utils/Recaller.js'
import { KIND, getCodecs } from '../public/js/dataModel/CODECS.js'
import { Upserter } from '../public/js/dataModel/Upserter.js'
import { Uint8ArrayLayerPointer } from '../public/js/dataModel/Uint8ArrayLayerPointer.js'

export const s3PeerRecaller = new Recaller('S3Peer.js')

/** @typedef {{commit: Uint8Array, promise: Promise, error: any}} CommitSync */
/** @typedef {{layerIndex: number, promise: Promise, error: any}} LayerIndexSync */
/** @typedef {{layerIndexSync: LayerIndexSync, commitSyncs: Array.<CommitSync>}} LayerPointerSyncs */

/** @type {Object.<string, Object.<string, LayerPointerSyncs>>} */
const _s3SyncStatusByBucketAndPublicKey = {}

export class S3Peer extends Upserter {
  compactPublicKeys = new Set()

  #updateSourceObjects = () => {
    const lastLayer = this.layerIndex
    const remoteWantSents = this.remoteExports.lookup()
    this.compactPublicKeys = new Set([...this.compactPublicKeys, ...Object.keys(remoteWantSents ?? {})])
    this.upsert(Object.fromEntries([...this.compactPublicKeys].map(compactPublicKey => {
      let commitErrors
      const sent = this.lookup()?.[compactPublicKey]?.sent ?? []
      const { want: remoteWant, sent: remoteSent } = remoteWantSents?.[compactPublicKey]
      const { layerIndex, error } = getLayerIndex(this.s3Client, this.bucket, compactPublicKey, this.recaller)
      if (error) return [compactPublicKey, { error }]
      if (layerIndex === undefined) return [compactPublicKey, { message: 'awaiting layerIndex' }]
      if (remoteWant) {
        remoteWant.forEach(([start, end]) => {
          for (let index = start; index <= layerIndex && index < end; ++index) {
            if (!sent[index]) {
              const { commit, error } = getValue(this.s3Client, this.bucket, compactPublicKey, index, this.recaller)
              if (error) {
                commitErrors ??= []
                commitErrors[index] = error
              } else if (commit) {
                const address = this.upsert(commit, getCodecs(KIND.OPAQUE))
                sent[index] = address
              }
            }
          }
        })
      }
      if (remoteSent) {
        for (let index = layerIndex + 1; index < remoteSent.length; ++index) {
          const address = remoteSent[index]
          if (address) {
            putCommit(this.s3Client, this.bucket, compactPublicKey, index, this.remoteExports.lookup(address), this.recaller)
          }
        }
      }
      const updatedLayerIndex = getLayerIndex(this.s3Client, this.bucket, compactPublicKey, this.recaller).layerIndex
      const want = [[updatedLayerIndex + 1, Number.POSITIVE_INFINITY]]
      return [
        compactPublicKey,
        { want, sent, commitErrors }
      ]
    })))
    if (this.layerIndex > lastLayer + 1) this.collapseTo(lastLayer + 1)
  }

  constructor (
    s3Client,
    bucket,
    name,
    recaller = s3PeerRecaller,
    remoteExports = new Uint8ArrayLayerPointer(undefined, recaller, `${name}.remoteExports`)
  ) {
    super(name, recaller)
    this.s3Client = s3Client
    this.bucket = bucket
    this.remoteExports = remoteExports
    this.updateSourceObjects('initialize')
  }

  addSourceObject (compactPublicKey, msg = `${this.name}.addSourceObject(${this.bucket}/${compactPublicKey})`) {
    this.compactPublicKeys.add(compactPublicKey)
    this.updateSourceObjects(msg)
  }

  updateSourceObjects (name = 'S3Peer.updateSourceObjects') {
    this.recaller.watch(name, this.#updateSourceObjects)
  }

  cleanup () {
    this.recaller.unwatch(this.#updateSourceObjects)
  }
}

/**
 * @param {string} compactPublicKey
 * @param {number} index
 * @returns {LayerPointerSyncs}
 */
function getS3LayerPointerSyncs (bucket, compactPublicKey) {
  _s3SyncStatusByBucketAndPublicKey[bucket] ??= {}
  _s3SyncStatusByBucketAndPublicKey[bucket][compactPublicKey] ??= {
    layerIndexSync: undefined,
    commitSyncs: []
  }
  return _s3SyncStatusByBucketAndPublicKey[bucket][compactPublicKey]
}

const indexToKey = (compactPublicKey, index) => `${compactPublicKey}/${`000000${index.toString(32)}`.slice(-6)}`

/**
 * @returns {LayerIndexSync}
 */
export function getLayerIndex (s3Client, bucket, compactPublicKey, recaller = s3PeerRecaller) {
  const getExists = async index => {
    const listObjectsV2Response = await s3Client.send(new ListObjectsV2Command({
      ...(index ? { StartAfter: indexToKey(compactPublicKey, index - 1) } : {}),
      MaxKeys: 1,
      Bucket: bucket,
      Prefix: compactPublicKey
    }))
    return !!listObjectsV2Response.KeyCount
  }
  const layerPointerSyncs = getS3LayerPointerSyncs(bucket, compactPublicKey)
  recaller.reportKeyAccess(layerPointerSyncs, 'layerIndex', 'getLayerIndex', `${bucket}/${compactPublicKey}`)
  if (!layerPointerSyncs.layerIndexSync || layerPointerSyncs.layerIndexSync.error) {
    layerPointerSyncs.layerIndexSync = {
      promise: (async () => {
        let lengthGuess = 0
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
        layerPointerSyncs.layerIndexSync.layerIndex = lengthGuess - 1
        recaller.reportKeyMutation(layerPointerSyncs, 'layerIndex', 'getLayerIndex', `${bucket}/${compactPublicKey}`)
        return layerPointerSyncs.layerIndexSync.layerIndex
      })()
    }
  }
  return layerPointerSyncs.layerIndexSync
}

/**
 * @returns {CommitSync}
 */
export function putCommit (s3Client, bucket, compactPublicKey, index, commit, recaller = s3PeerRecaller) {
  const layerPointerSyncs = getS3LayerPointerSyncs(bucket, compactPublicKey)
  const { commitSyncs } = layerPointerSyncs
  if (!commitSyncs[index] || commitSyncs[index].error) {
    commitSyncs[index] = {
      promise: (async () => {
        if (index > 0) {
          const prevCommit = await getValue(s3Client, bucket, compactPublicKey, index - 1).promise
          const verified = await Committer.verifySignedCommit(commit, prevCommit, compactPublicKey)
          if (!verified) {
            commitSyncs[index].error = `failed to verify commit ${index}`
            console.error(`failed to verify commit ${bucket}/${compactPublicKey}/${index}`)
            recaller.reportKeyMutation(layerPointerSyncs, index, 'verifySignedCommit falsy', `${bucket}/${compactPublicKey}`)
            return
          }
        }
        console.log(`### [s3peer to s3] ${commit.length} bytes outgoing`)
        await s3Client.send(new PutObjectCommand({
          Bucket: bucket,
          Body: commit,
          Key: indexToKey(compactPublicKey, index)
        }))
        commitSyncs[index].commit = commit
        recaller.reportKeyMutation(layerPointerSyncs, index, 'putCommit', `${bucket}/${compactPublicKey}`)
        if (index > layerPointerSyncs.layerIndexSync.layerIndex) {
          layerPointerSyncs.layerIndexSync.layerIndex = index
          recaller.reportKeyMutation(layerPointerSyncs, 'layerIndex', 'putCommit', `${bucket}/${compactPublicKey}`)
        }
        return commit
      })()
    }
  }
  return commitSyncs[index]
}

/**
 * @returns {CommitSync}
 */
export function getValue (s3Client, bucket, compactPublicKey, index, recaller = s3PeerRecaller) {
  const layerPointerSyncs = getS3LayerPointerSyncs(bucket, compactPublicKey)
  recaller.reportKeyAccess(layerPointerSyncs, index, 'getValue', `${bucket}/${compactPublicKey}`)
  const { commitSyncs } = layerPointerSyncs
  if (!commitSyncs[index] || commitSyncs[index].error) {
    commitSyncs[index] = {
      promise: (async () => {
        try {
          const object = await s3Client.send(new GetObjectCommand({
            Bucket: bucket,
            Key: indexToKey(compactPublicKey, index)
          }))
          const commit = await object.Body.transformToByteArray()
          commitSyncs[index].commit = commit
          recaller.reportKeyMutation(layerPointerSyncs, index, 'getValue', `${bucket}/${compactPublicKey}`)
          console.log(`### [s3peer to s3] ${commit.length} bytes incoming`)
          return commit
        } catch (error) {
          console.error(error)
          commitSyncs[index].error = error.message
        }
      })()
    }
  }
  return commitSyncs[index]
}
