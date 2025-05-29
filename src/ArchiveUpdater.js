import { AbstractUpdater } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/AbstractUpdater.js'

/**
 * @typedef {import('@aws-sdk/client-s3').S3Client} S3Client
 * @typedef {import('../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/Recaller.js').Recaller} Recaller
 */

export class ArchiveUpdater extends AbstractUpdater {
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
}
