import { TurtleBranchUpdater } from '../branches/cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleBranchUpdater.js'
import { ArchiveUpdater } from './ArchiveUpdater.js'

/**
 * @typedef {import('../branches/cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js').TurtleBranchStatus} TurtleBranchStatus
 * @typedef {import('../branches/cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
 * @typedef {import('../branches/cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/Recaller.js').Recaller} Recaller
 */

/**
 * @param {TurtleDB} turtleDB
 * @param {Recaller} recaller
 * @param {string} path
 */
export async function archiveSync (turtleDB, recaller, path) {
  const tbMuxBinding = async (/** @type {TurtleBranchStatus} */ status) => {
    const turtleBranch = status.turtleBranch
    const name = turtleBranch.name
    const publicKey = status.publicKey
    const archiveUpdater = new ArchiveUpdater(`to_archive_#${name}`, publicKey, recaller, path)
    const tbUpdater = new TurtleBranchUpdater(`from_archive_#${name}`, turtleBranch, publicKey, true, recaller)
    archiveUpdater.connect(tbUpdater)
    archiveUpdater.start()
    tbUpdater.start()
    if (!status.bindings.has(tbMuxBinding)) await tbUpdater.settle
  }
  turtleDB.bind(tbMuxBinding)
}
