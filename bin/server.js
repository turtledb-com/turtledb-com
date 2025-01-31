#!/usr/bin/env node
import { start } from 'repl'
import { Option, program } from 'commander'
import { Peer } from '../public/js/turtle/peer/Peer.js'
import { Signer } from '../public/js/turtle/Signer.js'
import { question } from 'readline-sync'
import { TurtleDictionary } from '../public/js/turtle/TurtleDictionary.js'
import { ConnectionS3 } from '../public/js/turtle/peer/ConnectionS3.js'

program
  .name('turtledb-com')
  .addOption(new Option('--username <string>', 'username to use for Signer').env('TURTLEDB_USERNAME'))
  .addOption(new Option('--password <string>', 'password to use for Signer').env('TURTLEDB_PASSWORD'))
  .addOption(new Option('--s3-end-point <string>', 'endPoint for s3 (like "https://sfo3.digitaloceanspaces.com")').env('TURTLEDB_S3_END_POINT'))
  .addOption(new Option('--s3-region <string>', 'region for s3 (like "sfo3")').env('TURTLEDB_S3_REGION'))
  .addOption(new Option('--s3-bucket <string>', 'bucket for s3').env('TURTLEDB_S3_BUCKET'))
  .addOption(new Option('--s3-access-key-id <string>', 'accessKeyId for s3').env('TURTLEDB_S3_ACCESS_KEY_ID'))
  .addOption(new Option('--s3-secret-access-key <string>', 'secretAccessKey for s3').env('TURTLEDB_S3_SECRET_ACCESS_KEY'))
  .option('-f, --fsdir <path...>', 'file paths of directories to sync from', [])
  .option('-j, --jsobj <path...>', 'JSONpaths of javascript object properties to sync to', [])
  .option('-t, --turtle <name...>', 'names of turtles to sync to', [])
  .option('-r, --root <path>', 'root directory of web server static assets', '')
  .option('-p, --port <number>', 'web server port number', x => +x, 8080)
  .option('-o, --origin-host <path>', 'path to server to sync with', '')
  .option('-q, --origin-port <number>', 'port of server to sync with', x => +x, 80)
  .option('-i, --interactive', 'flag to start repl')
  .parse()

const options = program.opts()
options.username ??= question('username: ')
options.password ??= question('password: ', { hideEchoBack: true })
const { username, password, s3EndPoint, s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey, fsdir, jsobj, turtle, root, port, originHost, originPort, interactive } = options

const peer = new Peer(username)
const signer = new Signer(username, password)

if (interactive) {
  global.peer = peer
  global.signer = signer
  global.TurtleDictionary = TurtleDictionary
  global.Signer = Signer
  const replServer = start({ breakEvalOnSigint: true })
  replServer.setupHistory('.node_repl_history', err => {
    if (err) console.error(err)
  })
  replServer.on('exit', process.exit)
}

if (s3EndPoint || s3Region || s3Bucket || s3AccessKeyId || s3SecretAccessKey) {
  if (!s3EndPoint || !s3Region || !s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
    throw new Error('--s3-end-point, --s3-region, --s3-bucket, --s3-access-key-id, and --s3-secret-access-key must all be set to connect to s3')
  }
  const connectionToS3 = new ConnectionS3('connectionToS3', peer, s3EndPoint, s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey)
  peer.connections.push(connectionToS3)
}
