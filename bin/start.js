#!/usr/bin/env node

import { readFileSync } from 'fs'
import { start } from 'repl'
import { Option, program } from 'commander'
import { question, questionNewPassword } from 'readline-sync'
import { logError, logInfo, setLogLevel } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/logger.js'
import { Signer } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Signer.js'
import { TurtleDB } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js'
import { Recaller } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/Recaller.js'
import { TurtleDictionary } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/TurtleDictionary.js'
import { Workspace } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Workspace.js'
import { AS_REFS } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/codecs/CodecType.js'
import { archiveSync } from '../src/archiveSync.js'
import { mirrorSync } from '../src/mirrorSync.js'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))

program
  .name('turtledb-com')
  .version(version)
  .addOption(
    new Option('--username <string>', 'username to use for Signer')
      .env('TURTLEDB_USERNAME')
  )
  .addOption(
    new Option('--password <string>', 'password to use for Signer')
      .env('TURTLEDB_PASSWORD')
  )
  .addOption(
    new Option('--turtlename <string>', 'name for dataset')
      .env('TURTLEDB_TURTLENAME')
  )
  .option('-a, --archive', 'save all turtles to files by public key', false)
  .option('--archive-path', 'folder to archive to', 'archive')
  .option('-i, --interactive', 'flag to start repl', false)
  .option('-m, --mirror', 'flag to mirror files locally', false)
  .option('-v, --verbose [level]', 'log data flows', x => +x, false) // +false === 0 === INFO, +true === 1 === DEBUG
  .parse()

const options = program.opts()

setLogLevel(options.verbose)
const username = options.username || question('Username: ')
const turtlename = options.turtlename || question('Turtlename: ')
const signer = new Signer(username, options.password || questionNewPassword('Password (Backspace won\'t work here): ', { min: 4, max: 999 }))
const { publicKey } = await signer.makeKeysFor(turtlename)

logInfo(() => console.log({ username, turtlename, publicKey }))
const recaller = new Recaller('turtledb-com')
const turtleDB = new TurtleDB('turtledb-com', recaller)

if (options.archive) {
  const archivePath = options.archivePath
  logInfo(() => console.log(`archiving to ${archivePath}`))
  archiveSync(turtleDB, recaller, archivePath)
}

if (options.mirror) {
  logInfo(() => console.log('mirroring to file system'))
  mirrorSync(turtlename, turtleDB, signer)
}

if (options.interactive) {
  global.username = username
  global.turtlename = turtlename
  global.signer = signer
  global.publicKey = publicKey
  global.recaller = recaller
  global.turtleDB = turtleDB
  global.workspace = await turtleDB.makeWorkspace(signer, turtlename)

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
