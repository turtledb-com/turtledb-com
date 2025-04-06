#!/usr/bin/env node
import { start } from 'repl'
import { Option, program } from 'commander'
import { Signer } from '../public/js/turtle/Signer.js'
import { question } from 'readline-sync'
import { TurtleDictionary } from '../public/js/turtle/TurtleDictionary.js'
import { proxyWithRecaller } from '../public/js/utils/proxyWithRecaller.js'
import { createServer as createHttpsServer } from 'https'
import { createServer as createHttpServer } from 'http'
import { WebSocketServer } from 'ws'
import express from 'express'
import { join, extname } from 'path'
import { manageCert } from '../src/manageCert.js'
import { Workspace } from '../public/js/turtle/Workspace.js'
import { fsSync } from '../src/fsSync.js'

/**
 * @typedef {import('../public/js/turtle/TurtleBranch.js').TurtleBranch} TurtleBranch
 */

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
  .option('-n, --fsname <name...>', 'names of directories to sync from', [])
  .option('-j, --jspath <path...>', 'JSONpaths of javascript object properties to sync to', [])
  .option('-t, --turtle <name...>', 'names of turtles to sync to', [])
  .option('-b, --base <name>', 'base directory for otherwise unspecified assets', 'public')
  .option('-r, --root <path>', 'root directory of web server static assets', '')
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
const { username, password, s3EndPoint, s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey, fsdir, fsname, jspath, turtle, base, root, port, originHost, originPort, https, insecure, certpath, interactive } = options

console.log(https)

/** @type {Object.<string, TurtleBranch>} */
const turtleRegistry = proxyWithRecaller({})

const signer = new Signer(username, password)

if (interactive) {
  global.signer = signer
  global.turtleRegistry = turtleRegistry
  global.TurtleDictionary = TurtleDictionary
  global.Signer = Signer
  global.Workspace = Workspace
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
  const workspace = new Workspace(name, signer)
  turtleRegistry[publicKey] = workspace.committedBranch
  fsSync(workspace, path, jspath[i])
}

if (s3EndPoint || s3Region || s3Bucket || s3AccessKeyId || s3SecretAccessKey) {
  if (!s3EndPoint || !s3Region || !s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
    throw new Error('--s3-end-point, --s3-region, --s3-bucket, --s3-access-key-id, and --s3-secret-access-key must all be set to connect to s3')
  }
  // const connectionToS3 = new S3Connection('connectionToS3', peer, s3EndPoint, s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey)
}

if (port) {
  const app = express()
  app.use((req, _res, next) => {
    console.log(req.method, req.url)
    next()
  })
  const basekey = await signer.makeKeysFor(base)
  app.use((req, res, next) => {
    const matchGroups = req.url.match(/\/(?<publiKey>[0-9A-Za-z]{41,51})\/(?<relativePath>.*)$/)?.groups
    const type = extname(req.url)
    if (matchGroups) {
      const { publiKey, relativePath } = matchGroups
      const turtle = turtleRegistry[publiKey]
      if (!turtle) return next()
      const body = turtle.lookup('document', 'value', 'fs', relativePath)
      if (!body) return next()
      res.type(type)
      res.send(body)
    } else if (req.url.match(/^\/$|^\/index.html?$/)) {
      res.set('Content-Type', 'text/html')
      res.send(
`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ALL YOUR TURTLE ARE BELONG TO US.</title>
    <base href="${basekey.publicKey}/"/>
    <script type="module" src="index.js"></script>
    <link rel="manifest" href="index.webmanifest" />
    <link rel="icon" href="svg/tinker.svg" />
  </head>

  <body style="margin: 0; background: dimgray;">
    <p>
      loading the turtle that will load the turtles that will load the
      turtles...
    </p>
  </body>
</html>
`
      )
    } else {
      next()
    }
  })
  const fullpath = join(process.cwd(), 'public')
  app.use(express.static(fullpath))

  let server
  if (https || insecure) {
    if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    const fullcertpath = join(process.cwd(), certpath)
    const certOptions = await manageCert(fullcertpath)
    server = createHttpsServer(certOptions, app)
  } else {
    server = createHttpServer(app)
  }

  const wss = new WebSocketServer({ server })
  // const recaller = new Recaller('webserver')
  // let count = 0

  wss.on('connection', ws => {
    console.log('new connection attempt')
    /*
    const peer = new Peer(`[webserver.js to wss-connection#${count++}]`, recaller)
    const connectionCycle = (receive, setSend) => new Promise((resolve, reject) => {
      ws.on('message', buffer => receive(new Uint8Array(buffer)))
      ws.onclose = resolve
      ws.onerror = reject
      setSend(uint8Array => ws.send(uint8Array.buffer))
    })
    attachPeerToCycle(peer, connectionCycle)
    */
  })

  server.listen(port, () => {
    console.log(`webserver started: ${(https || insecure) ? 'https' : 'http'}://localhost:${port}`)
  })
}
