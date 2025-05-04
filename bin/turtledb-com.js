#!/usr/bin/env node

import { createConnection, createServer } from 'net'
import { start } from 'repl'
import { Option, program } from 'commander'
import { question } from 'readline-sync'
import { S3Client } from '@aws-sdk/client-s3'
import { fsSync } from '../src/fsSync.js'
import { webSync } from '../src/webSync.js'
import { S3Updater } from '../src/S3Updater.js'
import { Signer } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Signer.js'
import { TurtleDictionary } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/TurtleDictionary.js'
import { Workspace } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Workspace.js'
import { Recaller } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/Recaller.js'
import { TurtleBranchUpdater } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleBranchUpdater.js'
import { AS_REFS } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/codecs/CodecType.js'
import { TurtleDB } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js'
import { TurtleBranchMultiplexer } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleBranchMultiplexer.js'
import { combineUint8ArrayLikes } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/combineUint8ArrayLikes.js'
import { combineUint8Arrays } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/combineUint8Arrays.js'

program
  .name('turtledb-com')
  .version(process.env.npm_package_version)
  .addOption(new Option('--username <string>', 'username to use for Signer').env('TURTLEDB_USERNAME'))
  .addOption(new Option('--password <string>', 'password to use for Signer').env('TURTLEDB_PASSWORD'))
  .addOption(new Option('--s3-end-point <string>', 'endPoint for s3 (like "https://sfo3.digitaloceanspaces.com")').env('TURTLEDB_S3_END_POINT'))
  .addOption(new Option('--s3-region <string>', 'region for s3 (like "sfo3")').env('TURTLEDB_S3_REGION'))
  .addOption(new Option('--s3-bucket <string>', 'bucket for s3').env('TURTLEDB_S3_BUCKET'))
  .addOption(new Option('--s3-access-key-id <string>', 'accessKeyId for s3').env('TURTLEDB_S3_ACCESS_KEY_ID'))
  .addOption(new Option('--s3-secret-access-key <string>', 'secretAccessKey for s3').env('TURTLEDB_S3_SECRET_ACCESS_KEY'))
  .option('--disable-s3', 'disable S3', false)
  .option('-n, --fs-name <name...>', 'names of turtles to sync files with', [])
  .option('-j, --fs-obj <name...>', 'name of objects in turtles to store files in (default: fs)', [])
  .option('-w, --web-base <name>', 'name of turtle to use for web assets', 'public')
  .option('-p, --web-port <number>', 'web server port number', x => +x, 8080)
  .option('-o, --origin-host <path>', 'path to server to sync with', '')
  .option('-q, --origin-port <number>', 'port of server to sync with', x => +x, 1024)
  .option('-t, --turtle-port <number>', 'port to open to sync with', x => +x, 0)
  .option('--https', 'use https', false)
  .option('--insecure', '(local dev) allow unauthorized', false)
  .option('--certpath <string>', '(local dev) path to self-cert', 'dev/cert.json')
  .option('-i, --interactive', 'flag to start repl')
  .parse()

const options = program.opts()
options.username ??= question('username: ')
options.password ??= question('password: ', { hideEchoBack: true })
const { username, password, s3EndPoint, s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey, disableS3, fsName, fsObj, webBase, webPort, originHost, originPort, turtlePort, https, insecure, certpath, interactive } = options

const signer = new Signer(username, password)
const recaller = new Recaller('turtledb-com')
const turtleDB = new TurtleDB('turtledb-com', recaller)

const _encodeUint8Array = uint8Array => {
  const encodedLength = new Uint32Array([uint8Array.length])
  return combineUint8ArrayLikes([encodedLength, uint8Array])
}

if (!disableS3 && (s3EndPoint || s3Region || s3Bucket || s3AccessKeyId || s3SecretAccessKey)) {
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
  turtleDB.bind(async status => {
    const turtleBranch = status.turtleBranch
    const name = turtleBranch.name
    const publicKey = status.publicKey
    const s3Updater = new S3Updater(`s3Updater"${name}"`, publicKey, recaller, s3Client, s3Bucket)
    const tbUpdater = new TurtleBranchUpdater(`tbUpdater"${name}"`, turtleBranch, publicKey, false, recaller)
    s3Updater.connect(tbUpdater)
    s3Updater.start()
    tbUpdater.start()
    await tbUpdater.settle
  })
} else if (originHost) {
  ;(async () => {
    let t = 100
    let connectionCount = 0
    while (true) {
      console.log('-- creating new origin connection')
      console.time('-- origin connection lifespan')
      const tbMux = new TurtleBranchMultiplexer(`origin_connection_#${connectionCount}`, false, turtleDB)
      for (const publicKey of turtleDB.getPublicKeys()) {
        await tbMux.getTurtleBranchUpdater(publicKey)
      }
      const tbMuxBinding = async status => {
        try {
          // console.log('tbMuxBinding about to get next', status.publicKey)
          const updater = await tbMux.getTurtleBranchUpdater(status.turtleBranch.name, status.publicKey, status.turtleBranch)
          // console.log('tbMuxBinding about to await settle', updater.name)
          await updater.settle
          // console.log('tbMuxBinding settled')
        } catch (error) {
          console.error(error)
        }
      }
      turtleDB.bind(tbMuxBinding)
      let _connectionCount
      try {
        const socket = createConnection(originPort, originHost)
        socket.on('connect', () => {
          ;(async () => {
            try {
              for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
                if (socket.closed) break
                // console.log('origin u8aTurtleGenerator', u8aTurtle.uint8Array)
                console.log('originHost outgoing data', u8aTurtle.uint8Array)
                if (!socket.write(Buffer.from(_encodeUint8Array(u8aTurtle.uint8Array)))) {
                  console.log('false')
                }
              }
            } catch (error) {
              console.error(error)
            }
          })()
          t = 100
          _connectionCount = ++connectionCount
          console.log('-- onopen', { _connectionCount })
        })
        let inProgress = new Uint8Array()
        let totalLength
        socket.on('data', buffer => {
          inProgress = combineUint8Arrays([inProgress, new Uint8Array(buffer)])
          if (inProgress.length < 4) return
          totalLength = new Uint32Array(inProgress.slice(0, 4).buffer)[0]
          while (inProgress.length >= totalLength + 4) {
            const uint8Array = inProgress.slice(4, totalLength + 4)
            inProgress = inProgress.slice(totalLength + 4)
            console.log('originHost incoming data', uint8Array)
            tbMux.incomingBranch.append(uint8Array)
          }
        })
        await new Promise((resolve, reject) => {
          socket.on('close', resolve)
          socket.on('error', reject)
        })
      } catch (error) {
        console.error(error)
      }
      tbMux.stop()
      turtleDB.unbind(tbMuxBinding)
      console.timeEnd('-- origin connection lifespan')
      t = Math.min(t, 2 * 60 * 1000) // 2 minutes max (unjittered)
      t = t * (1 + Math.random()) // exponential backoff and some jitter
      console.log(`-- waiting ${(t / 1000).toFixed(2)}s`)
      await new Promise(resolve => setTimeout(resolve, t))
    }
  })()
}

if (turtlePort) {
  let connectionCount = 0
  const server = createServer(async socket => {
    let tbMux
    try {
      ++connectionCount
      console.log('turtle connection', connectionCount)
      // const _connectionCount = connectionCount
      // keep alive
      // const intervalId = setInterval(() => {
      //   if (_connectionCount !== connectionCount) clearInterval(intervalId)
      //   else ws.send(new Uint8Array())
      // }, 20000)
      tbMux = new TurtleBranchMultiplexer(`turtle_connection_#${connectionCount}`, true, turtleDB)
      ;(async () => {
        try {
          for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
            // console.log('writy', socket.closed)
            if (socket.closed) break
            // console.log('turtlePort u8aTurtleGenerator', u8aTurtle.uint8Array)
            console.log('turtleHost outgoing data', u8aTurtle.uint8Array)
            if (!socket.write(Buffer.from(_encodeUint8Array(u8aTurtle.uint8Array)))) {
              console.log('falsy')
            }
          }
        } catch (error) {
          console.error(error)
        }
      })()
      let inProgress = new Uint8Array()
      let totalLength
      socket.on('data', buffer => {
        inProgress = combineUint8Arrays([inProgress, new Uint8Array(buffer)])
        if (inProgress.length < 4) return
        totalLength = new Uint32Array(inProgress.slice(0, 4).buffer)[0]
        while (inProgress.length >= totalLength + 4) {
          const uint8Array = inProgress.slice(4, totalLength + 4)
          inProgress = inProgress.slice(totalLength + 4)
          console.log('originHost incoming data', uint8Array)
          tbMux.incomingBranch.append(uint8Array)
        }
      })

      await new Promise((resolve, reject) => {
        socket.on('close', resolve)
        socket.on('error', reject)
      })
    // clearInterval(intervalId)
    } catch (error) {
      console.error(error)
    }
    tbMux?.stop?.()
  })
  server.listen(turtlePort, () => {
    console.log('opened turtlePort:', turtlePort)
  })
}

if (interactive) {
  global.signer = signer
  global.turtleDB = turtleDB
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

for (let i = 0; i < fsName.length; ++i) {
  fsSync(fsName[i], turtleDB, signer, fsObj[i])
}

if (webPort) {
  const baseKeys = await signer.makeKeysFor(webBase)
  webSync(webPort, baseKeys.publicKey, turtleDB, https, insecure, certpath)
}
