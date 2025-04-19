#!/usr/bin/env node

import { start } from 'repl'
import { Option, program } from 'commander'
import { Signer } from '../public/js/turtle/Signer.js'
import { question } from 'readline-sync'
import { TurtleDictionary } from '../public/js/turtle/TurtleDictionary.js'
import { proxyWithRecaller } from '../public/js/utils/proxyWithRecaller.js'
import { Workspace } from '../public/js/turtle/Workspace.js'
import { fsSync } from '../src/fsSync.js'
import { webSync } from '../src/webSync.js'
import { Recaller } from '../public/js/utils/Recaller.js'
import { S3Client } from '@aws-sdk/client-s3'
import { S3Updater } from '../src/S3Updater.js'
import { TurtleBranchUpdater } from '../public/js/turtle/connections/TurtleBranchUpdater.js'
import { TurtleBranch } from '../public/js/turtle/TurtleBranch.js'
import { AS_REFS } from '../public/js/turtle/codecs/CodecType.js'

program
  .name('turtledb-com')
  .addOption(new Option('--username <string>', 'username to use for Signer').env('TURTLEDB_USERNAME'))
  .addOption(new Option('--password <string>', 'password to use for Signer').env('TURTLEDB_PASSWORD'))
  .addOption(new Option('--s3-end-point <string>', 'endPoint for s3 (like "https://sfo3.digitaloceanspaces.com")').env('TURTLEDB_S3_END_POINT'))
  .addOption(new Option('--s3-region <string>', 'region for s3 (like "sfo3")').env('TURTLEDB_S3_REGION'))
  .addOption(new Option('--s3-bucket <string>', 'bucket for s3').env('TURTLEDB_S3_BUCKET'))
  .addOption(new Option('--s3-access-key-id <string>', 'accessKeyId for s3').env('TURTLEDB_S3_ACCESS_KEY_ID'))
  .addOption(new Option('--s3-secret-access-key <string>', 'secretAccessKey for s3').env('TURTLEDB_S3_SECRET_ACCESS_KEY'))
  .option('--nos3', 'disable S3', false)
  .option('-f, --fsdir <path...>', 'file paths of directories to sync files from', [])
  .option('-n, --fsname <name...>', 'names of turtles to sync files with', [])
  .option('-j, --fsobj <name...>', 'name of objects in turtles to store files in (default: fs)', [])
  .option('-b, --base <name>', 'name of turtle to use for web assets', 'public')
  .option('-p, --port <number>', 'web server port number', x => +x, 8080)
  .option('-o, --origin-host <path>', 'path to server to sync with', '')
  .option('-q, --origin-port <number>', 'port of server to sync with', x => +x, 80)
  .option('--https', 'use https', false)
  .option('--insecure', '(local dev) allow unauthorized', false)
  .option('--certpath <string>', '(local dev) path to self-cert', 'dev/cert.json')
  .option('-i, --interactive', 'flag to start repl')
  .parse()

const options = program.opts()
options.username ??= question('username: ')
options.password ??= question('password: ', { hideEchoBack: true })
const { username, password, s3EndPoint, s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey, nos3, fsdir, fsname, fsobj, base, port, originHost, originPort, https, insecure, certpath, interactive } = options

// console.log(options)

const signer = new Signer(username, password)
const recaller = new Recaller('turtledb-com')
/** @type {Object.<string, TurtleBranch>} */
const turtleRegistry = proxyWithRecaller({}, recaller)
// s3 overrides this
const _getTurtleBranchByPublicKey = async (publicKey, name = publicKey) => {
  if (!turtleRegistry[publicKey]) {
    turtleRegistry[publicKey] = new TurtleBranch(name, recaller)
  }
  return turtleRegistry[publicKey]
}
let getTurtleBranchByPublicKey = _getTurtleBranchByPublicKey

if (!nos3 && (s3EndPoint || s3Region || s3Bucket || s3AccessKeyId || s3SecretAccessKey)) {
  if (!s3EndPoint || !s3Region || !s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
    throw new Error('--s3-end-point, --s3-region, --s3-bucket, --s3-access-key-id, and --s3-secret-access-key must all be set to connect to s3')
  }
  /** @type {import('@aws-sdk/client-s3').S3ClientConfig} */
  const s3Client = new S3Client({
    endpoint: s3EndPoint,
    forcePathStyle: false,
    region: s3Region,
    credentials: {
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey
    }
  })
  getTurtleBranchByPublicKey = async (publicKey, name = publicKey) => {
    if (!turtleRegistry[publicKey]) {
      const s3Updater = new S3Updater(`s3Updater"${name}"`, publicKey, recaller, s3Client, s3Bucket)
      const turtleBranch = await _getTurtleBranchByPublicKey(publicKey, name)
      const tbUpdater = new TurtleBranchUpdater(`tbUpdater"${name}"`, turtleBranch, publicKey, false, recaller)
      s3Updater.connect(tbUpdater)
      s3Updater.start()
      tbUpdater.start()
      await tbUpdater.settle
    }
    return turtleRegistry[publicKey]
  }
}

if (interactive) {
  global.signer = signer
  global.turtleRegistry = turtleRegistry
  global.getTurtleBranchByPublicKey = getTurtleBranchByPublicKey
  global.TurtleDictionary = TurtleDictionary
  global.Signer = Signer
  global.Workspace = Workspace
  global.AS_REFS = AS_REFS
  const replServer = start({ breakEvalOnSigint: true })
  replServer.setupHistory('.node_repl_history', err => {
    if (err) console.error(err)
  })
  replServer.on('exit', process.exit)
}

for (let i = 0; i < Math.max(fsdir.length, fsname.length); ++i) {
  const path = fsdir[i] ?? fsname[i]
  const name = fsname[i] ?? fsdir[i]
  const { publicKey } = await signer.makeKeysFor(name)
  const workspace = new Workspace(name, signer, await getTurtleBranchByPublicKey(publicKey, name))
  // turtleRegistry[publicKey] = workspace.committedBranch
  fsSync(workspace, path, fsobj[i])
}

if (port) {
  const baseKeys = await signer.makeKeysFor(base)
  webSync(port, baseKeys.publicKey, recaller, turtleRegistry, getTurtleBranchByPublicKey, https, insecure, certpath)
}
