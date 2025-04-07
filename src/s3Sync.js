import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import { TurtleBranchMultiplexer } from '../public/js/turtle/connections/TurtleBranchMultiplexer.js'

/**
 * @typedef {import('../public/js/turtle/TurtleBranch').TurtleBranch} TurtleBranch
 * @typedef {import('../public/js/utils/Recaller').Recaller} Recaller
 */

/**
 *
 * @param {Object.<string, TurtleBranch>} turtleRegistry
 * @param {Recaller} recaller
 */
export async function s3Sync (turtleRegistry, recaller) {
  recaller.watch('s3', () => {
    for (const publicKey in turtleRegistry) {
      const turtleBranch = turtleRegistry[publicKey]
      console.log('s3 watching', turtleBranch)
      // add turtleBranch to S3Multiplexer
    }
  })
}

class S3Multiplexer extends TurtleBranchMultiplexer {
  constructor (name, recaller) {
    super(name, true, recaller)
  }
}
