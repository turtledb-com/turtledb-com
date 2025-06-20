import { start } from 'repl'
import { fsSync } from './fsSync.js'
import { webSync } from './webSync.js'
import { s3Sync } from './s3Sync.js'
import { originSync } from './originSync.js'
import { outletSync } from './outletSync.js'
import { archiveSync } from './archiveSync.js'
import { Recaller } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/Recaller.js'
import { TurtleDB } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js'
import { Signer } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Signer.js'
import { TurtleDictionary } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/TurtleDictionary.js'
import { Workspace } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Workspace.js'
import { AS_REFS } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/codecs/CodecType.js'
import { logInfo, setLogLevel, logError } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/logger.js'

export async function startServer (config = {}) {
  setLogLevel(config.verbose)
  const recaller = new Recaller('turtledb-com')
  const turtleDB = new TurtleDB('turtledb-com', recaller)
  const configCopy = JSON.parse(JSON.stringify(config))
  if (configCopy.password) configCopy.password = '****'
  if (configCopy.s3) configCopy.s3.secretAccessKey = '****'
  logInfo(() => console.log('starting server with config:', configCopy))
  if (config.origin) {
    const { origin } = config
    originSync(turtleDB, origin.host, origin.port)
  }

  if (config.s3) {
    const { s3 } = config
    s3Sync(turtleDB, recaller, s3.endpoint, s3.region, s3.accessKeyId, s3.secretAccessKey, s3.bucket)
  }

  if (config.archive) {
    const { path } = config.archive
    archiveSync(turtleDB, recaller, path)
  }

  if (config.outlet) {
    const { outlet } = config
    outletSync(turtleDB, outlet.port)
  }

  if (config.fsReadWrite) {
    const { fsReadWrite, fsFolder } = config
    for (let i = 0; i < fsReadWrite.length; ++i) {
      fsSync(fsReadWrite[i].name, turtleDB, config.signer, fsFolder)
    }
  }

  if (config.fsReadOnly) {
    const { fsReadOnly, fsFolder } = config
    for (let i = 0; i < fsReadOnly.length; ++i) {
      fsSync(fsReadOnly[i].key, turtleDB, undefined, fsFolder)
    }
  }

  if (config.web) {
    const { web } = config
    const key = web.key ?? (await config.signer.makeKeysFor(web.name)).publicKey
    webSync(web.port, key, turtleDB, web.https, web.insecure, web.certpath, web.fallback)
  }

  if (config.interactive) {
    global.signer = config.signer
    global.turtleDB = turtleDB
    global.TurtleDictionary = TurtleDictionary
    global.Signer = Signer
    global.Workspace = Workspace
    global.AS_REFS = AS_REFS
    const replServer = start({ breakEvalOnSigint: true })
    replServer.setupHistory('.node_repl_history', err => {
      if (err) logError(() => console.error(err))
    })
    replServer.on('exit', process.exit)
  }

  return turtleDB
}
