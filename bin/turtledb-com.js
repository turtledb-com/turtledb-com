#!/usr/bin/env node

import { readFileSync } from 'fs'
import { start } from 'repl'
import { Option, program } from 'commander'
import { question, questionNewPassword } from 'readline-sync'
import { LOG_LEVELS, logError, logInfo, logSilly, setLogLevel } from '../public/js/utils/logger.js'
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
import { defaultPublicKey } from '../public/js/utils/handleRedirect.js'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))

const defaultWebPort = 8080
const defaultRemoteHost = 'turtledb.com'
const defaultRemotePort = 1024
const defaultLocalPort = 1024
const defaultWebFallback = defaultPublicKey

const makeParserWithOptions = (...options) => value => {
  if (options.length) {
    if (value === true) return options[0]
    if (value === '') return options[0]
    if (value === 'true') return options[0]
  }
  if (value === 'false') return false
  if (!isNaN(+value)) value = +value
  if (options.length <= 1 || options.includes(value)) return value
  throw new Error(`value must be one of: ${options.join(', ')}`)
}

program
  .name('turtledb-com')
  .version(version)
  .option('--env-file <path>', 'path to .env file')

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
    new Option('-f, --fs-mirror [resolve]', 'mirror files locally and handle')
      .default(false)
      .preset(THROW)
      .choices([OURS, THEIRS, THROW, ''])
      .argParser(makeParserWithOptions(THROW, OURS, THEIRS))
      .env('TURTLEDB_FS_MIRROR')
  )
  .addOption(
    new Option('-i, --interactive', 'flag to start repl')
      .default(false)
      .env('TURTLEDB_INTERACTIVE')
  )
  .addOption(
    new Option('-a, --archive', 'save all turtles to files by public key')
      .default(false)
      .env('TURTLEDB_ARCHIVE')
  )
  .addOption(
    new Option('-v, --verbose [level]', 'log data flows')
      .default(0)
      .preset(1)
      .choices(Object.values(LOG_LEVELS).map(v => v.toString()))
      .argParser(makeParserWithOptions(1, ...Object.values(LOG_LEVELS)))
      .env('TURTLEDB_VERBOSE')
  )

  .addOption(
    new Option('-w, --web-port [number]', 'web port to sync from')
      .default(false)
      .preset(defaultWebPort)
      .argParser(makeParserWithOptions(defaultWebPort))
      .env('TURTLEDB_WEB_PORT')
      .helpGroup('Web Server:')
  )
  .addOption(
    new Option('--web-fallback <string>', 'project public key to use as fallback for web')
      .env('TURTLEDB_WEB_FALLBACK')
      .helpGroup('Web Server:')
  )
  .addOption(
    new Option('--web-certpath <string>', 'path to self-cert for web')
      .env('TURTLEDB_WEB_CERTPATH')
      .helpGroup('Web Server:')
  )
  .addOption(
    new Option('--web-insecure', '(local dev) allow unauthorized for web')
      .env('TURTLEDB_WEB_INSECURE')
      .helpGroup('Web Server:')
  )

  .addOption(
    new Option('--remote-host [string]', 'remote host to sync to')
      .default(false)
      .preset(defaultRemoteHost)
      .argParser(makeParserWithOptions(defaultRemoteHost))
      .env('TURTLEDB_REMOTE_HOST')
      .helpGroup('TurtleDB Syncing:')
  )
  .addOption(
    new Option('-r, --remote-port [number]', 'remote port to sync to')
      .default(false)
      .preset(defaultRemotePort)
      .argParser(makeParserWithOptions(defaultRemotePort))
      .env('TURTLEDB_REMOTE_PORT')
      .helpGroup('TurtleDB Syncing:')
  )

  .addOption(
    new Option('-l, --local-port [number]', 'local port to sync from')
      .default(false)
      .preset(defaultLocalPort)
      .argParser(makeParserWithOptions(defaultLocalPort))
      .env('TURTLEDB_LOCAL_PORT')
      .helpGroup('TurtleDB Syncing:')
  )

  .addOption(
    new Option('--s3-end-point <string>', 'endpoint for s3 (like "https://sfo3.digitaloceanspaces.com")')
      .default(false)
      .argParser(makeParserWithOptions())
      .env('TURTLEDB_S3_END_POINT')
      .helpGroup('S3-like Service Syncing:')
  )
  .addOption(
    new Option('--s3-region <string>', 'region for s3 (like "sfo3")')
      .env('TURTLEDB_S3_REGION')
      .helpGroup('S3-like Service Syncing:')
  )
  .addOption(
    new Option('--s3-access-key-id <string>', 'accessKeyId for s3')
      .env('TURTLEDB_S3_ACCESS_KEY_ID')
      .helpGroup('S3-like Service Syncing:')
  )
  .addOption(
    new Option('--s3-secret-access-key <string>', 'secretAccessKey for s3')
      .env('TURTLEDB_S3_SECRET_ACCESS_KEY')
      .helpGroup('S3-like Service Syncing:')
  )
  .addOption(
    new Option('--s3-bucket <string>', 'bucket for s3')
      .env('TURTLEDB_S3_BUCKET')
      .helpGroup('S3-like Service Syncing:')
  )

  .parse()

const options = program.opts()
if (options.envFile) {
  config({ path: options.envFile })
  program.parse() // re-parse with new env vars
  Object.assign(options, program.opts()) // update options with new env vars
}
let username = options.username
let turtlename = options.turtlename
let signer
let publicKey = defaultPublicKey
if (options.fsMirror !== false) {
  username ||= question('Username: ')
  turtlename ||= question('Turtlename: ')
  signer = new Signer(username, options.password || questionNewPassword('Password [ATTENTION!: Backspace won\'t work here]: ', { min: 4, max: 999 }))
} else if (username && turtlename && options.password) {
  signer = new Signer(username, options.password)
  publicKey = (await signer.makeKeysFor(turtlename)).publicKey
  logInfo(() => console.log({ username, turtlename, publicKey }))
}

setLogLevel(options.verbose)
logSilly(() => console.log({ options }))
// console.log({ options })
// process.exit(0)

const recaller = new Recaller('turtledb-com')
const turtleDB = new TurtleDB('turtledb-com', recaller)

if (options.localPort !== false) {
  const localPort = +options.localPort || defaultLocalPort
  logInfo(() => console.log(`listening for local connections on port ${localPort}`))
  outletSync(turtleDB, localPort)
}

if (options.remoteHost !== false || options.remotePort !== false) {
  const remoteHost = options.remoteHost || defaultRemoteHost
  const remotePort = +options.remotePort || defaultRemotePort
  logInfo(() => console.log(`connecting to remote at ${remoteHost}:${remotePort}`))
  originSync(turtleDB, remoteHost, remotePort)
}

if (options.s3EndPoint !== false) {
  s3Sync(turtleDB, recaller, options.s3EndPoint, options.s3Region, options.s3AccessKeyId, options.s3SecretAccessKey, options.s3Bucket)
}

if (options.archive) {
  const archivePath = '__turtledb_archive__'
  logInfo(() => console.log(`archiving to ${archivePath}`))
  archiveSync(turtleDB, recaller, archivePath)
}

if (options.fsMirror !== false) {
  if (![OURS, THEIRS, THROW].includes(options.fsMirror)) {
    logError(() => console.error(`fs-mirror resolve option must be "${OURS}", "${THEIRS}" or "${THROW}" (you provided: "${options.fsMirror}")`))
    process.exit(1)
  }
  logInfo(() => console.log('mirroring to file system'))
  fileSync(turtlename, turtleDB, signer, '.', options.fsMirror)
}

if (options.webPort !== false) {
  const webPort = +options.webPort
  const insecure = !!options.webInsecure
  const https = insecure || !!options.webCertpath
  const certpath = options.webCertpath || '__turtledb_dev__/cert.json'
  logInfo(() => console.log(`listening for web connections on port ${webPort} (https: ${https}, insecure: ${insecure}, certpath: ${certpath})`))
  webSync(webPort, publicKey || defaultPublicKey, turtleDB, https, insecure, certpath, options.webFallback || defaultWebFallback)
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
  global.setLogLevel = setLogLevel
  global.AS_REFS = AS_REFS
  const replServer = start({ breakEvalOnSigint: true })
  replServer.setupHistory('.node_repl_history', err => {
    if (err) logError(() => console.error(err))
  })
  replServer.on('exit', process.exit)
}
