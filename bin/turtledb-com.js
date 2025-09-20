#!/usr/bin/env node

import { readFileSync } from 'fs'
import { start } from 'repl'
import { Option, program } from 'commander'
import { question, questionNewPassword } from 'readline-sync'
import { logError, logInfo, setLogLevel } from '../public/js/utils/logger.js'
import { Signer } from '../public/js/turtle/Signer.js'
import { TurtleDB } from '../public/js/turtle/connections/TurtleDB.js'
import { Recaller } from '../public/js/utils/Recaller.js'
import { OURS, THEIRS, THROW, TurtleDictionary } from '../public/js/turtle/TurtleDictionary.js'
import { Workspace } from '../public/js/turtle/Workspace.js'
import { AS_REFS } from '../public/js/turtle/codecs/CodecType.js'
import { archiveSync } from '../src/archiveSync.js'
import { fileSync } from '../src/fileSync.js'
import { s3Sync } from '../src/s3Sync.js'
import { originSync } from '../src/originSync.js'
import { outletSync } from '../src/outletSync.js'
import { webSync } from '../src/webSync.js'
import { config } from 'dotenv'

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
  .option('-f, --fs-mirror [resolve]', `flag to mirror files locally and (optionally) how to handle conflicts (${OURS}, ${THEIRS}, ${THROW})`)
  .option('-i, --interactive', 'flag to start repl', false)
  .option('-a, --archive', 'save all turtles to files by public key', false)
  .option('-v, --verbose [level]', 'log data flows', x => +x, false) // +false === 0 === INFO, +true === 1 === DEBUG

  .option('--env-file <path>', 'path to .env file')

  .addOption(
    new Option('--web-port <number>', 'web port to sync from')
      .env('TURTLEDB_WEB_PORT')
  )
  .addOption(
    new Option('--web-fallback <string>', 'project public key to use as fallback for web')
      .env('TURTLEDB_WEB_FALLBACK')
  )
  .addOption(
    new Option('--web-certpath <string>', 'path to self-cert for web')
      .env('TURTLEDB_WEB_CERTPATH')
  )
  .addOption(
    new Option('--web-insecure', '(local dev) allow unauthorized for web')
      .env('TURTLEDB_WEB_INSECURE')
  )
  .option('--web', 'enable web connection')
  .option('--no-web', 'disable web connection')

  .addOption(
    new Option('--remote-host <string>', 'remote host to sync to')
      .env('TURTLEDB_REMOTE_HOST')
  )
  .addOption(
    new Option('--remote-port <number>', 'remote port to sync to')
      .env('TURTLEDB_REMOTE_PORT')
  )
  .option('--remote', 'enable remote connection')
  .option('--no-remote', 'disable remote connection')

  .addOption(
    new Option('--local-port <number>', 'local port to sync from')
      .env('TURTLEDB_LOCAL_PORT')
  )
  .option('--local', 'enable local connection')
  .option('--no-local', 'disable local connection')

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

  .parse()

const options = program.opts()
if (options.envFile) {
  config({ path: options.envFile })
  program.parse() // re-parse with new env vars
  Object.assign(options, program.opts()) // update options with new env vars
}

setLogLevel(options.verbose)
const username = options.username || question('Username: ')
const turtlename = options.turtlename || question('Turtlename: ')
const signer = new Signer(username, options.password || questionNewPassword('Password [ATTENTION!: Backspace won\'t work here]: ', { min: 4, max: 999 }))
const { publicKey } = await signer.makeKeysFor(turtlename)
logInfo(() => console.log({ username, turtlename, publicKey }))
const recaller = new Recaller('turtledb-com')
const turtleDB = new TurtleDB('turtledb-com', recaller)

if (options.local === true || (options.local === undefined && options.localPort)) {
  const localPort = +options.localPort || 1024
  logInfo(() => console.log(`listening for local connections on port ${localPort}`))
  outletSync(turtleDB, localPort)
}

if (options.remote === true || (options.remote === undefined && (options.remoteHost || options.remotePort))) {
  const remoteHost = options.remoteHost || 'turtledb.com'
  const remotePort = +options.remotePort || 1024
  logInfo(() => console.log(`connecting to remote at ${remoteHost}:${remotePort}`))
  originSync(turtleDB, remoteHost, remotePort)
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
  if (options.fsMirror === true) options.fsMirror = THROW // default to THROW if --fs-mirror is provided without argument
  if (![OURS, THEIRS, THROW].includes(options.fsMirror)) {
    logError(() => console.error(`fs-mirror resolve option must be "${OURS}", "${THEIRS}" or "${THROW}" (you provided: "${options.fsMirror}")`))
    process.exit(1)
  }
  logInfo(() => console.log('mirroring to file system'))
  fileSync(turtlename, turtleDB, signer, '.', options.fsMirror)
}

if (options.web === true || (options.web === undefined && options.webPort)) {
  const webPort = +options.webPort || 8080
  const insecure = !!options.webInsecure
  const https = insecure || !!options.webCertpath
  const certpath = options.webCertpath || '__turtledb_dev__/cert.json'
  logInfo(() => console.log(`listening for web connections on port ${webPort} (https: ${https}, insecure: ${insecure}, certpath: ${certpath})`))
  webSync(webPort, publicKey, turtleDB, https, insecure, certpath, options.webFallback)
}

console.log(options)
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
  global.setLogLevel = setLogLevel
  global.AS_REFS = AS_REFS
  const replServer = start({ breakEvalOnSigint: true })
  replServer.setupHistory('.node_repl_history', err => {
    if (err) logError(() => console.error(err))
  })
  replServer.on('exit', process.exit)
}
