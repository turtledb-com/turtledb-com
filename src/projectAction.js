import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { getConfigFromOptions } from './getConfigFromOptions.js'
import { join } from 'path'
import { startServer } from './startServer.js'

export function projectAction (projectname, username, options, defaultCpk) {
  const overrideConfig = {
    interactive: true,
    archive: { path: 'archive' },
    fsReadOnly: [{ key: defaultCpk }],
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
  // console.log(config)
  const projectPath = process.cwd()
  if (!existsSync(projectPath)) mkdirSync(projectPath)
  console.log(`writing ${projectPath}/.gitignore`)
  writeFileSync(join(projectPath, '.gitignore'), [
    '.env',
    'node_modules/',
    'dev/',
    'node_repl_history',
    ''
  ].join('\n'))
  console.log(`writing ${projectPath}/.env`)
  writeFileSync(join(projectPath, '.env'), [
    `TURTLEDB_USERNAME="${config.username}"`,
    `TURTLEDB_PASSWORD="${config.password}"`
  ].join('\n') + '\n')
  console.log(`writing ${projectPath}/package.json`)
  writeFileSync(join(projectPath, 'package.json'), JSON.stringify({
    name: projectname,
    author: config.username,
    license: 'GPL-3.0-or-later',
    scripts: {
      start: 'source .env && npx turtledb-com --config config.json'
    }
  }, null, 2) + '\n')
  console.log(`writing ${projectPath}/config.json`)
  writeFileSync(join(projectPath, 'config.json'), JSON.stringify(overrideConfig, null, 2) + '\n')
  console.log(`project directory initialized: ${projectPath}`)
  console.log(`running 'npm start' from ${projectPath} `)
  startServer(config)
}
