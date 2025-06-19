import { getConfigFromOptions } from './getConfigFromOptions.js'
import { join } from 'path'
import { startServer } from './startServer.js'
import { lstat, mkdir, symlink, unlink, writeFile } from 'fs/promises'
import { logInfo } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/logger.js'

export async function projectAction (projectname, username, options, defaultCpk) {
  const overrideConfig = {
    interactive: true,
    archive: { path: 'archive' },
    fsReadOnly: [{ key: defaultCpk, name: 'turtledb-com' }],
    fsReadWrite: [{ name: projectname }],
    web: {
      name: projectname,
      port: 8080,
      fallback: defaultCpk,
      https: true,
      insecure: true,
      certpath: 'dev/cert.json'
    },
    origin: { host: 'turtledb.com', port: 1024 }
  }
  if (username) {
    overrideConfig.username = username
    overrideConfig.password = null
  }
  const config = getConfigFromOptions(options, overrideConfig)
  const turtleDB = await startServer(config)
  const turtleBranch = await turtleDB.makeWorkspace(config.signer, projectname)
  let value = (await turtleBranch).lookup('document', 'value') || {}
  if (typeof value !== 'object') value = {}
  if (JSON.stringify(value?.['config.json']) !== JSON.stringify(overrideConfig)) {
    logInfo(() => console.log(`committing new ${projectname}/document/value/config.json`))
    value['config.json'] = JSON.stringify(overrideConfig, null, 2)
    await turtleBranch.commit(value, 'upsert config.json')
  }
  const projectPath = process.cwd()
  if (!(await lstat(projectPath))) await mkdir(projectPath)
  logInfo(() => console.log(`writing ${projectPath}/.gitignore`))
  await writeFile(join(projectPath, '.gitignore'), [
    '.env',
    'node_modules/',
    'dev/',
    'node_repl_history',
    ''
  ].join('\n'))
  logInfo(() => console.log(`writing ${projectPath}/.env`))
  await writeFile(join(projectPath, '.env'), [
    `TURTLEDB_USERNAME="${config.username}"`,
    `TURTLEDB_PASSWORD="${config.password}"`
  ].join('\n') + '\n')
  logInfo(() => console.log(`writing ${projectPath}/package.json`))
  await writeFile(join(projectPath, 'package.json'), JSON.stringify({
    name: projectname,
    author: config.username,
    license: 'GPL-3.0-or-later',
    scripts: {
      start: `(export $(grep -v '^#' .env | xargs) && npx turtledb-com --config branches/${projectname}/config.json)`
    }
  }, null, 2) + '\n')
  await mkdir(join(projectPath, 'branches'), { recursive: true })
  const { publicKey } = await config.signer.makeKeysFor(projectname)
  const keyPath = join(projectPath, 'branches', `.${publicKey}`)
  const namePath = join(projectPath, 'branches', projectname)
  try {
    await unlink(namePath)
  } catch {
    // don't worry about not being able to delete what isn't there
  }
  await symlink(keyPath, namePath)
  logInfo(() => console.log(`project directory initialized: ${projectPath}`))
  logInfo(() => console.log(`starting server. run 'npm start' from ${projectPath} to start manually`))
  logInfo(() => console.log(`
╭──────────────────────────────────────────────────────────────────────────────────────────╮
│                                                                                          │
│  ╭─▶ \x1b[32;3m${namePath}\x1b[0m${' '.repeat(Math.max(0, 84 - namePath.length))}│
│  ╰──────────────────╮                                                                    │
│    this directory ──╯  will be mirrored at this url ──╮                                  │
│      ╭────────────────────────────────────────────────╯                                  │
│      ╰─▶ \x1b[34;4mhttps://www.turtledb.com/${publicKey}\x1b[0m${' '.repeat(Math.max(0, 55 - publicKey.length))}│
│                                                                                          │
╰──────────────────────────────────────────────────────────────────────────────────────────╯
`))
}
