#!/usr/bin/env node

import { readFileSync } from 'fs'
import { start } from 'repl'
import { Option, program } from 'commander'
import { fsSync } from '../src/fsSync.js'
import { webSync } from '../src/webSync.js'
import { Signer } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Signer.js'
import { TurtleDictionary } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/TurtleDictionary.js'
import { Workspace } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Workspace.js'
import { Recaller } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/Recaller.js'
import { AS_REFS } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/codecs/CodecType.js'
import { TurtleDB } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js'
import { s3Sync } from '../src/s3Sync.js'
import { originSync } from '../src/originSync.js'
import { outletSync } from '../src/outletSync.js'
import { getConfigFromOptions } from '../src/getConfigFromOptions.js'
import { projectAction } from '../src/projectAction.js'
import { archiveSync } from '../src/archiveSync.js'

/**
 * @typedef {import('../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js').TurtleBranchStatus} TurtleBranchStatus
 */

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
const recaller = new Recaller('turtledb-com')
const turtleDB = new TurtleDB('turtledb-com', recaller)

const defaultCpk = 'cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2'

program
  .name('turtledb-com')
  .version(version)
program
  .command('dev')
  .description('start a local dev server and syncing to local file-system')
  .argument('<string>', 'turtle branch name')
  .argument('[string]', 'username for Signer')
  .action((fsName, username) => {
    const config = getConfigFromOptions(program.opts(), {
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
          key: defaultCpk,
          obj: 'fs'
        }
      ],
      web: {
        name: fsName,
        port: 8080,
        fallback: defaultCpk,
        https: true,
        insecure: true,
        certpath: 'dev/cert.json'
      },
      s3: null
    })
    console.log(config)
  })
program
  .command('project')
  .description('a basic local setup for developing a project')
  .argument('<{string} projectname>', 'turtle branch name')
  .argument('[{string} username]', 'username for branch signer')
  .action((projectname, username) => {
    projectAction(projectname, username, program.opts(), defaultCpk)
  })
program
  .command('default', { isDefault: true })
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
  .option('-x, --web-key <string>', 'public key of turtle to use for web assets', defaultCpk)
  .option('-p, --web-port <number>', 'web server port number', x => +x, 0)
  .option('--web-fallback <string>', 'compact public key to use as fallback', defaultCpk)
  .option('-o, --origin-host <path>', 'path to server to sync with', '')
  .option('-q, --origin-port <number>', 'port of server to sync with', x => +x, 1024)
  .option('-t, --outlet-port <number>', 'port to open to sync with', x => +x, 0)
  .option('--https', 'use https', false)
  .option('--insecure', '(local dev) allow unauthorized', false)
  .option('--certpath <string>', '(local dev) path to self-cert', 'dev/cert.json')
  .option('-i, --interactive', 'flag to start repl')
  .option('-c, --config <string>', 'path to a .json TDBConfig file to use')
  .option('-r, --remote-config <string>', 'name of TDBConfig turtle to use')
  .option('-a, --archive', 'download all turtle layers', false)
  .option('--archive-path', 'folder to archive to', 'archive')
  .parse()

async function startServer (config = getConfigFromOptions(program.opts())) {
  console.log(config)
  if (config.archive) {
    const { path } = config.archive
    archiveSync(turtleDB, recaller, path)
  }

  if (config.origin) {
    const { origin } = config
    originSync(turtleDB, origin.host, origin.port)
  }

  if (config.s3) {
    const { s3 } = config
    s3Sync(turtleDB, recaller, s3.endpoint, s3.region, s3.accessKeyId, s3.secretAccessKey, s3.bucket)
  }

  if (config.outlet) {
    const { outlet } = config
    outletSync(turtleDB, outlet.port)
  }

  if (config.fsReadWrite) {
    const { fsReadWrite } = config
    for (let i = 0; i < fsReadWrite.length; ++i) {
      fsSync(fsReadWrite[i].name, turtleDB, config.signer, fsReadWrite[i].obj)
    }
  }

  if (config.fsReadOnly) {
    const { fsReadOnly } = config
    for (let i = 0; i < fsReadOnly.length; ++i) {
      fsSync(fsReadOnly[i].key, turtleDB, undefined, fsReadOnly[i].obj)
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
      if (err) console.error(err)
    })
    replServer.on('exit', process.exit)
  }
}
