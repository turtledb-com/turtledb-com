import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { getConfigFromOptions } from './getConfigFromOptions.js'
import { join } from 'path'

export function projectAction (projectname, username, options, defaultCpk) {
  const overrideConfig = { fsReadWrite: [{ name: projectname, obj: 'fs' }] }
  if (username) {
    overrideConfig.username = username
    overrideConfig.password = null
  }
  const config = getConfigFromOptions(options, overrideConfig)
  console.log(config)
  const projectPath = join(process.cwd(), projectname)
  if (!existsSync(projectPath)) mkdirSync(projectPath)
  console.log(`writing ${projectname}/.gitignore`)
  writeFileSync(join(projectPath, '.gitignore'), [
    '.env',
    'node_modules/',
    'dev/',
    ''
  ].join('\n'))
  console.log(`writing ${projectname}/.env`)
  writeFileSync(join(projectPath, '.env'), [
    `TURTLEDB_USERNAME="${config.username}"`,
    `TURTLEDB_PASSWORD="${config.password}"`
  ].join('\n') + '\n')
  console.log(`writing ${projectname}/package.json`)
  writeFileSync(join(projectPath, 'package.json'), JSON.stringify({
    name: projectname,
    author: config.username,
    license: 'GPL-3.0-or-later',
    scripts: {
      start: 'source .env && npx turtledb-com --config config.json'
    }
  }, null, 2) + '\n')
  console.log(`writing ${projectname}/config.json`)
  writeFileSync(join(projectPath, 'config.json'), JSON.stringify({
    interactive: true,
    fsReadOnly: [{ key: defaultCpk, obj: 'fs' }],
    fsReadWrite: [{ name: projectname, obj: 'fs' }],
    web: {
      name: projectname,
      port: 8080,
      fallback: defaultCpk,
      https: true,
      insecure: true,
      certpath: 'dev/cert.json'
    },
    origin: { host: 'turtledb.com', port: 1024 }
  }, null, 2) + '\n')
  console.log(`project directory initialized: ${projectPath}`)
  console.log(`running 'npm start' from ${projectPath} `)
}
