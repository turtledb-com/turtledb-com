import { getConfigFromOptions } from './getConfigFromOptions.js'
import { join } from 'path'
import { startServer } from './startServer.js'
import { lstat, mkdir, symlink, unlink, writeFile } from 'fs/promises'

export async function projectAction (projectname, username, options, defaultCpk) {
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
  console.log(overrideConfig)
  const { publicKey } = await config.signer.makeKeysFor(projectname)
  console.log(projectname)
  console.log({ publicKey, projectname })
  // console.log(config)
  const projectPath = process.cwd()
  if (!(await lstat(projectPath))) await mkdir(projectPath)
  console.log(`writing ${projectPath}/.gitignore`)
  await writeFile(join(projectPath, '.gitignore'), [
    '.env',
    'node_modules/',
    'dev/',
    'node_repl_history',
    ''
  ].join('\n'))
  console.log(`writing ${projectPath}/.env`)
  await writeFile(join(projectPath, '.env'), [
    `TURTLEDB_USERNAME="${config.username}"`,
    `TURTLEDB_PASSWORD="${config.password}"`
  ].join('\n') + '\n')
  console.log(`writing ${projectPath}/package.json`)
  await writeFile(join(projectPath, 'package.json'), JSON.stringify({
    name: projectname,
    author: config.username,
    license: 'GPL-3.0-or-later',
    scripts: {
      start: 'source .env && npx turtledb-com --config config.json'
    }
  }, null, 2) + '\n')
  console.log(`writing ${projectPath}/config.json`)
  console.log(overrideConfig)
  await writeFile(join(projectPath, 'config.json'), JSON.stringify(overrideConfig, null, 2) + '\n')
  await mkdir(join(projectPath, 'branches'), { recursive: true })
  const keyPath = join(projectPath, 'branches', `.${publicKey}`)
  const namePath = join(projectPath, 'branches', projectname)
  try {
    await unlink(namePath)
  } catch {
    // don't worry about not deleting what isn't there
  }
  await symlink(keyPath, namePath)
  console.log(`project directory initialized: ${projectPath}`)
  console.log(`https://www.turtledb.com/${publicKey}`)
  console.log(`running 'npm start' from ${projectPath} `)
  startServer(config)
}
