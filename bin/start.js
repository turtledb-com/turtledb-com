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
import { fileSync } from '../src/fileSync.js'
import { s3Sync } from '../src/s3Sync.js'
import { originSync } from '../src/originSync.js'
import { outletSync } from '../src/outletSync.js'

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
  .addOption(
    new Option('--s3-end-point <string>', 'endpoint for s3 (like "https://sfo3.digitaloceanspaces.com")')
      .env('TURTLEDB_S3_END_POINT')
  )
  .addOption(
    new Option('--s3-region <string>', 'region for s3 (like "sfo3")')
      .env('TURTLEDB_S3_REGION')
  )
  .addOption(
    new Option('--s3-access-key-id <string>', 'accessKeyId for s3')
      .env('TURTLEDB_S3_ACCESS_KEY_ID')
  )
  .addOption(
    new Option('--s3-secret-access-key <string>', 'secretAccessKey for s3')
      .env('TURTLEDB_S3_SECRET_ACCESS_KEY')
  )
  .addOption(
    new Option('--s3-bucket <string>', 'bucket for s3')
      .env('TURTLEDB_S3_BUCKET')
  )
  .option('--no-s3', 'disable S3')
  .addOption(
    new Option('--origin-host <string>', 'remote host to sync to')
      .env('TURTLEDB_ORIGIN_HOST')
  )
  .addOption(
    new Option('--origin-port <number>', 'remote port to sync to')
      .env('TURTLEDB_ORIGIN_PORT')
  )
  .option('--no-origin', 'disable origin connection')
  .option('-p, --port <number>', 'local port to sync from', x => +x, 0)
  .option('-a, --archive', 'save all turtles to files by public key', false)
  .option('-i, --interactive', 'flag to start repl', false)
  .option('-f, --fs-mirror', 'flag to mirror files locally', false)
  .option('-v, --verbose [level]', 'log data flows', x => +x, false) // +false === 0 === INFO, +true === 1 === DEBUG
  .parse()

const options = program.opts()

setLogLevel(options.verbose)
const username = options.username || question('Username: ')
const turtlename = options.turtlename || question('Turtlename: ')
const signer = new Signer(username, options.password || questionNewPassword('Password [ATTENTION!: Backspace won\'t work here]: ', { min: 4, max: 999 }))
const { publicKey } = await signer.makeKeysFor(turtlename)
logInfo(() => console.log({ username, turtlename, publicKey }))
const recaller = new Recaller('turtledb-com')
const turtleDB = new TurtleDB('turtledb-com', recaller)

if (options.port) {
  logInfo(() => console.log(`listening for outlet connections on port ${options.port}`))
  outletSync(turtleDB, options.port)
}

if (options.origin !== false && options.originHost) {
  const originPort = +options.originPort || 1024
  logInfo(() => console.log(`connecting to origin at ${options.originHost}:${originPort}`))
  originSync(turtleDB, options.originHost, originPort)
}

if (options.s3 !== false && (options.s3EndPoint || options.s3Region || options.s3Bucket || options.s3AccessKeyId || options.s3SecretAccessKey)) {
  s3Sync(turtleDB, recaller, options.s3EndPoint, options.s3Region, options.s3AccessKeyId, options.s3SecretAccessKey, options.s3Bucket)
}

if (options.archive) {
  const archivePath = '__turtledb_archive__'
  logInfo(() => console.log(`archiving to ${archivePath}`))
  archiveSync(turtleDB, recaller, archivePath)
}

if (options.fsMirror) {
  logInfo(() => console.log('mirroring to file system'))
  fileSync(turtlename, turtleDB, signer, '.')
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
