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
import { readFileSync } from 'fs'
import mirror from '../configs/mirror.json' with { type: 'json' }

/**
 * @typedef {import('../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js').TurtleBranchStatus} TurtleBranchStatus
 */

/**
 * @typedef {{endpoint: string, region: string, bucket: string, accessKeyId: string, secretAccessKey: string}} TDBConfigS3
 * @typedef {Array.<{name: string, obj: string}>} TDBConfigFsReadWrite
 * @typedef {Array.<{key: string, obj: string}>} TDBConfigFsReadOnly
 * @typedef {{name: string, key: string, port: number, fallback: string, https: boolean, insecure: boolean, certpath: string}} TDBConfigWeb
 * @typedef {{host: string, port: number}} TDBConfigOrigin
 * @typedef {{port: number}} TDBConfigOutlet
 * @typedef {{username: string, password: string, interactive: boolean, s3: TDBConfigS3, fsReadWrite: TDBConfigFsReadWrite, fsReadOnly: TDBConfigFsReadOnly, web: TDBConfigWeb, origin: TDBConfigOrigin, outlet: TDBConfigOutlet}} TDBConfig
 */

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
const recaller = new Recaller('turtledb-com')
const turtleDB = new TurtleDB('turtledb-com', recaller)

program
  .name('turtledb-com')
  .version(version)
program
  .command('dev')
  .description('start a local dev server and syncing to local file-system')
  .argument('<string>', 'turtle branch name')
  .argument('[string]', 'username for Signer')
  .action((fsName, username) => {
    console.log({fsName, username})
    getConfigFromOptions({
      username,
      interactive: true,
      fsReadWrite: [
        {
          name: fsName,
          obj: 'fs'
        }
      ],
      fsReadOnly: [
        {
          key: "cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2",
          obj: "fs"
        }
      ],
      web: {
        name: fsName,
        port: 8080,
        fallback: "cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2",
        https: true,
        insecure: true,
        certpath: "dev/cert.json"
      },
      s3: null
    })
  })
program
  .command('default', {isDefault: true})
  .description('start services based on command-line only')
  .action(() => startServer())
program
  .addOption(new Option('--username <string>', 'username to use for Signer').env('TURTLEDB_USERNAME'))
  .addOption(new Option('--password <string>', 'password to use for Signer').env('TURTLEDB_PASSWORD'))
  .addOption(new Option('--s3-end-point <string>', 'endpoint for s3 (like "https://sfo3.digitaloceanspaces.com")').env('TURTLEDB_S3_END_POINT'))
  .addOption(new Option('--s3-region <string>', 'region for s3 (like "sfo3")').env('TURTLEDB_S3_REGION'))
  .addOption(new Option('--s3-bucket <string>', 'bucket for s3').env('TURTLEDB_S3_BUCKET'))
  .addOption(new Option('--s3-access-key-id <string>', 'accessKeyId for s3').env('TURTLEDB_S3_ACCESS_KEY_ID'))
  .addOption(new Option('--s3-secret-access-key <string>', 'secretAccessKey for s3').env('TURTLEDB_S3_SECRET_ACCESS_KEY'))
  .option('--disable-s3', 'disable S3', false)
  .option('-n, --fs-name <name...>', 'names of turtles to sync files with', [])
  .option('-j, --fs-obj <name...>', 'name of objects in turtles to store files in (default: fs)', [])
  .option('-k, --fs-public-key <string...>', 'public key of turtles to sync files with', [])
  .option('--fs-public-key-obj <name...>', 'name of objects in readonly turtles to store files in (default: fs)', [])
  .option('-w, --web-name <name>', 'name of turtle to use for web assets', 'public')
  .option('-x, --web-key <string>', 'public key of turtle to use for web assets', 'cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2')
  .option('-p, --web-port <number>', 'web server port number', x => +x, 0)
  .option('--web-fallback <string>', 'compact public key to use as fallback', 'cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2')
  .option('-o, --origin-host <path>', 'path to server to sync with', '')
  .option('-q, --origin-port <number>', 'port of server to sync with', x => +x, 1024)
  .option('-t, --outlet-port <number>', 'port to open to sync with', x => +x, 0)
  .option('--https', 'use https', false)
  .option('--insecure', '(local dev) allow unauthorized', false)
  .option('--certpath <string>', '(local dev) path to self-cert', 'dev/cert.json')
  .option('-i, --interactive', 'flag to start repl')
  .option('-c, --default-config <string>', 'path to a .json TDBConfig file to use')
  .parse()

/**
 * @param {TDBConfig} a 
 * @param {TDBConfig} b 
 * @returns {TDBConfig}
 */
function combineConfigs (a, b) {
  return {
    username: Object.hasOwn(a, 'username') ? a.username : b.username,
    password: Object.hasOwn(a, 'password') ? a.password : b.password,
    interactive: Object.hasOwn(a, 'interactive') ? a.interactive : b.interactive,
    s3: Object.hasOwn(a, 's3') ? a.s3 : b.s3,
    fsReadWrite: (a.fsReadWrite || []).concat(b.fsReadWrite || []),
    fsReadOnly: (a.fsReadOnly || []).concat(b.fsReadOnly || []),
    web: Object.hasOwn(a, 'web') ? a.web : b.web,
    origin: Object.hasOwn(a, 'origin') ? a.origin : b.origin,
    outlet: Object.hasOwn(a, 'outlet') ? a.outlet : b.outlet
  }
}
/**
 * @returns {TDBConfig}
 */
function getConfigFromOptions (overrideConfig = {}) {
  const options = program.opts()
  const { username, password, s3EndPoint, s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey, disableS3, fsName, fsObj, fsPublicKey, fsPublicKeyObj, webName, webKey, webPort, webFallback, originHost, originPort, outletPort, https, insecure, certpath, interactive, defaultConfig } = options
  console.log(interactive)
  /** @type {TDBConfig} */
  const defaults = defaultConfig ? JSON.parse(readFileSync(defaultConfig, 'utf8')) : {}
  /** @type {TDBConfig} */
  const optionsConfig = {}
  if (username) optionsConfig.username = username
  if (password) optionsConfig.password = password
  if (typeof interactive === 'boolean') optionsConfig.interactive = interactive
  if (!disableS3 && (s3EndPoint || s3Region || s3Bucket || s3AccessKeyId || s3SecretAccessKey)) {
    optionsConfig.s3 = {
      endpoint: s3EndPoint, 
      region: s3Region, 
      bucket: s3Bucket, 
      accessKeyId: s3AccessKeyId, 
      secretAccessKey: s3SecretAccessKey
    }
  }
  if (fsName?.length) {
    optionsConfig.fsReadWrite = fsName.map((name, index) => ({
      name, 
      obj: fsObj?.[index] ?? 'fs'
    }))
  }
  if (fsPublicKey?.length) {
    optionsConfig.fsReadOnly = fsPublicKey.map((key, index) => ({
      key, 
      obj: fsPublicKeyObj?.[index] ?? 'fs'
    }))
  }
  if (webPort) {
    optionsConfig.web = {
      name: webName,
      key: webKey,
      port: webPort,
      fallback: webFallback,
      https,
      insecure,
      certpath
    }
  }
  if (originHost) optionsConfig.origin = { host: originHost, port: originPort}
  if (outletPort) optionsConfig.outlet = { port: outletPort }
  const defaultedOptionsConfig = combineConfigs(optionsConfig, defaults)
  const config = combineConfigs(overrideConfig, defaultedOptionsConfig)
  if (config.s3 && !(config.s3.endpoint && config.s3.region && config.s3.bucket && config.s3.accessKeyId && config.s3.secretAccessKey)) {
    throw new Error('--s3-end-point, --s3-region, --s3-bucket, --s3-access-key-id, and --s3-secret-access-key must all be set to connect to s3')
  }
  if (config.fsReadWrite?.length || (config.web?.name && !config.web?.key)) {
    config.username ??= question('username: ')
    config.password ??= question('password: ', { hideEchoBack: true })
  }
  if (config.username && config.password) config.signer = new Signer(username, password)
  return config
}

async function startServer (config = getConfigFromOptions()) {
  console.log(config)
  if (config.s3) {
    const { s3 } = config
    /** @type {import('@aws-sdk/client-s3').S3ClientConfig} */
    const s3Client = new S3Client({
      endpoint: s3.endpoint,
      forcePathStyle: false,
      region: s3.region,
      credentials: {
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey
      }
    })
    const tbMuxBinding = async (/** @type {TurtleBranchStatus} */ status) => {
      const turtleBranch = status.turtleBranch
      const name = turtleBranch.name
      const publicKey = status.publicKey
      const s3Updater = new S3Updater(`to_S3_#${name}`, publicKey, recaller, s3Client, s3.bucket)
      const tbUpdater = new TurtleBranchUpdater(`from_S3_#${name}`, turtleBranch, publicKey, false, recaller)
      s3Updater.connect(tbUpdater)
      s3Updater.start()
      tbUpdater.start()
      console.log('tbUpdater about to await settle', tbUpdater.name)
      if (!status.bindings.has(tbMuxBinding)) await tbUpdater.settle
      console.log('tbUpdater settled')
    }
    turtleDB.bind(tbMuxBinding)
  } else if (config.origin) {
    const { origin } = config
    ;(async () => {
      let t = 100
      let connectionCount = 0
      while (true) {
        console.log('-- creating new origin connection')
        console.time('-- origin connection lifespan')
        const tbMux = new TurtleBranchMultiplexer(`origin_#${origin.host}`, false, turtleDB)
        for (const publicKey of turtleDB.getPublicKeys()) {
          await tbMux.getTurtleBranchUpdater(tbMux.name, publicKey)
        }
        const tbMuxBinding = async (/** @type {TurtleBranchStatus} */ status) => {
          try {
            // console.log('tbMuxBinding about to get next', status.publicKey)
            const updater = await tbMux.getTurtleBranchUpdater(tbMux.name, status.publicKey, status.turtleBranch)
            console.log('updater about to await settle', updater.name, updater.turtleBranch.length)
            await updater.settle
            console.log('updater settled', updater.turtleBranch.length)
          } catch (error) {
            console.error(error)
          }
        }
        turtleDB.bind(tbMuxBinding)
        let _connectionCount
        try {
          const socket = createConnection(origin.port, origin.host)
          socket.on('connect', () => {
            ;(async () => {
              try {
                for await (const chunk of tbMux.makeReadableStream()) {
                  if (socket.closed) break
                  if (socket.write(chunk)) {
                    // console.log('origin.host outgoing data', chunk)
                  } else {
                    console.warn('socket failed to write')
                    // break
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
          const streamWriter = tbMux.makeWritableStream().getWriter()
          socket.on('data', buffer => {
            // console.log('origin.host incoming data', buffer)
            streamWriter.write(buffer)
          })
          await new Promise((resolve, reject) => {
            socket.on('close', resolve)
            socket.on('error', reject)
          })
        } catch (error) {
          if (error?.code === 'ECONNREFUSED') {
            console.log('-- connection refused')
          } else {
            console.error(error)
            throw error
          }
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

  if (config.outlet) {
    const { outlet } = config
    let connectionCount = 0
    const server = createServer(async socket => {
      let tbMux
      const _connectionCount = ++connectionCount
      try {
        console.log('turtle connection', _connectionCount)
        tbMux = new TurtleBranchMultiplexer(`outlet_#${_connectionCount}`, true, turtleDB)
        ;(async () => {
          try {
            for await (const chunk of tbMux.makeReadableStream()) {
              if (socket.closed) break
              if (socket.write(chunk)) {
                // console.log('origin.host outgoing data', chunk)
              } else {
                console.warn('socket failed to write')
                // break
              }
            }
          } catch (error) {
            console.error(error)
          }
        })()
        const streamWriter = tbMux.makeWritableStream().getWriter()
        socket.on('data', buffer => {
          // console.log('turtleHost incoming data', buffer)
          streamWriter.write(buffer)
        })

        await new Promise((resolve, reject) => {
          socket.on('close', resolve)
          socket.on('error', reject)
        })
      } catch (error) {
        if (error.code === 'ECONNRESET') {
          console.warn('ECONNRESET', _connectionCount)
        } else {
          console.error(error)
          throw error
        }
      }
      tbMux?.stop?.()
    })
    server.listen(outlet.port, () => {
      console.log('opened outlet.port:', outlet.port)
    })
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
      if (err) console.error(err)
    })
    replServer.on('exit', process.exit)
  }

  if (config.fsReadWrite) {
    const {fsReadWrite} = config
    for (let i = 0; i < fsReadWrite.length; ++i) {
      fsSync(fsReadWrite[i].name, turtleDB, signer, fsReadWrite[i].obj)
    }
  }

  if (config.fsReadOnly) {
    const {fsReadOnly} = config
    for (let i = 0; i < fsReadOnly.length; ++i) {
      fsSync(fsReadOnly[i].key, turtleDB, undefined, fsReadOnly[i].obj)
    }
  }

  if (config.web) {
    const { web } = config
    const key = web.key ?? (await signer.makeKeysFor(web.name)).publicKey
    webSync(web.port, key, turtleDB, web.https, web.insecure, web.certpath, web.fallback)
  }
}
