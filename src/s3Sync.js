import { S3Client } from '@aws-sdk/client-s3'
import { S3Updater } from './S3Updater.js'
import { TurtleBranchUpdater } from '../public/js/turtle/connections/TurtleBranchUpdater.js'
import { logDebug } from '../public/js/utils/logger.js'

export async function s3Sync (turtleDB, recaller, endpoint, region, accessKeyId, secretAccessKey, bucket) {
  /** @type {import('@aws-sdk/client-s3').S3ClientConfig} */
  const s3Client = new S3Client({
    requestHandler: { httpsAgent: { maxSockets: 500 } },
    endpoint,
    forcePathStyle: false,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  })
  const tbMuxBinding = async (/** @type {TurtleBranchStatus} */ status) => {
    const turtleBranch = status.turtleBranch
    const name = turtleBranch.name
    const publicKey = status.publicKey
    const s3Updater = new S3Updater(`to_S3_#${name}`, publicKey, recaller, s3Client, bucket)
    const tbUpdater = new TurtleBranchUpdater(`from_S3_#${name}`, turtleBranch, publicKey, false, recaller)
    s3Updater.connect(tbUpdater)
    s3Updater.start()
    tbUpdater.start()
    logDebug(() => console.log('tbUpdater about to await settle', tbUpdater.name))
    if (!status.bindings.has(tbMuxBinding)) await tbUpdater.settle
    logDebug(() => console.log('tbUpdater settled'))
  }
  turtleDB.bind(tbMuxBinding)
}
