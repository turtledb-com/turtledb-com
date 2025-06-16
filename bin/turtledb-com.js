#!/usr/bin/env node

import { readFileSync } from 'fs'
import { Option, program } from 'commander'
import { projectAction } from '../src/projectAction.js'
import { getConfigFromOptions } from '../src/getConfigFromOptions.js'
import { startServer } from '../src/startServer.js'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))

const defaultCpk = 'cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2'

program
  .name('turtledb-com')
  .version(version)
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
  .action(() => startServer(getConfigFromOptions(program.opts())))
program
  .addOption(new Option('--username <string>', 'username to use for Signer').env('TURTLEDB_USERNAME'))
  .addOption(new Option('--password <string>', 'password to use for Signer').env('TURTLEDB_PASSWORD'))
  .addOption(new Option('--s3-end-point <string>', 'endpoint for s3 (like "https://sfo3.digitaloceanspaces.com")').env('TURTLEDB_S3_END_POINT'))
  .addOption(new Option('--s3-region <string>', 'region for s3 (like "sfo3")').env('TURTLEDB_S3_REGION'))
  .addOption(new Option('--s3-bucket <string>', 'bucket for s3').env('TURTLEDB_S3_BUCKET'))
  .addOption(new Option('--s3-access-key-id <string>', 'accessKeyId for s3').env('TURTLEDB_S3_ACCESS_KEY_ID'))
  .addOption(new Option('--s3-secret-access-key <string>', 'secretAccessKey for s3').env('TURTLEDB_S3_SECRET_ACCESS_KEY'))
  .option('--no-s3', 'disable S3')
  .option('-n, --fs-name <name...>', 'names of branches to sync files with', [])
  .option('-k, --fs-key <string...>', 'public keys of branches to sync files with', [])
  .option('-b, --fs-folder <string>', 'folder to sync branches into', 'branches')
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
  .option('-a, --archive', 'save all turtles to files by public key', false)
  .option('--archive-path', 'folder to archive to', 'archive')
  .option('-v, --verbose', 'log data flows', false)
  .parse()
