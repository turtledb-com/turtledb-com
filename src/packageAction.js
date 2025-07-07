import { getConfigFromOptions } from './getConfigFromOptions.js'
import { join } from 'path'
import { startServer } from './startServer.js'
import { mkdir, readFile, symlink, unlink, writeFile } from 'fs/promises'
import { logInfo, logWarn } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/logger.js'
import { parse } from 'dotenv'
import { keyInYN, question, questionNewPassword } from 'readline-sync'

export async function packageAction (packagename, usernameArg, options, defaultCpk) {
  const projectPath = process.cwd()
  const packageJsonPath = join(projectPath, 'package.json')
  const branchesPath = join(projectPath, 'branches')
  const packagenamePath = join(branchesPath, packagename)
  const gitignorePath = join(projectPath, '.gitignore')
  const envPath = join(projectPath, '.env')

  async function getExistingPackage () {
    let existingPackage = {}
    try { existingPackage = JSON.parse(await readFile(packageJsonPath)) } catch { /* throwing means no existing package.json */ }
    if (existingPackage.name && !keyInYN(`Existing package "${existingPackage.name}" found. Copy existing package?`)) {
      logInfo(() => console.log('Please remove existing package files and run command again.\n  Goodbye 👋'))
      throw new Error('package.json conflict')
    }
    return existingPackage
  }

  async function getUpdatedEnv () {
    let existingEnv = {}
    try { existingEnv = parse(await readFile(envPath)) } catch { /* throwing means there's no file to worry about overwriting */ }
    const existingUsername = existingEnv.TURTLEDB_USERNAME
    const existingPassword = existingEnv.TURTLEDB_PASSWORD
    if (!usernameArg && existingUsername) logInfo(() => console.log(`using TURTLEDB_USERNAME="${usernameArg}" from existing .env`))
    const username = usernameArg || existingUsername || question('Username: ')
    if (existingPassword) logInfo(() => console.log('using TURTLEDB_PASSWORD from existing .env'))
    const password = (!usernameArg && existingPassword) || questionNewPassword('Password (Backspace won\'t work here): ', {
      min: 4,
      max: 9999
    })
    logInfo(() => console.log(`writing ${envPath}`))
    if (existingUsername !== username || existingPassword !== password) {
      if ((existingUsername || existingPassword) && !keyInYN('username/password changed from existing .env. Overwrite?')) {
        logInfo(() => console.log('Please remove existing .env file and run command again.\n  Goodbye 👋'))
        throw new Error('.env mismatch')
      }
      existingEnv.TURTLEDB_USERNAME = username
      existingEnv.TURTLEDB_PASSWORD = password
      await writeFile(envPath, Object.entries(existingEnv).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n')
    }
    return { username, password }
  }

  async function writeGitignore () {
    logInfo(() => console.log(`writing ${gitignorePath}`))
    try {
      await writeFile(gitignorePath, [
        '.env',
        'node_modules/',
        'dev/',
        'archive/',
        'node_repl_history',
        ''
      ].join('\n'), { flag: 'wx' })
    } catch {
      logWarn(() => console.warn(`unable to write ${gitignorePath}`))
    }
  }

  try {
    const packageJson = await getExistingPackage()
    console.log(packageJson)
    const { username, password } = await getUpdatedEnv()
    console.log(username, password)
    await writeGitignore()
    const existingConfig = packageJson['turtledb-com']
    const overrideConfig = {
      interactive: true,
      archive: { path: 'archive' },
      fsReadOnly: [{ key: defaultCpk, name: 'turtledb-com' }],
      fsReadWrite: [{ name: packagename }],
      web: {
        name: packagename,
        port: 8080,
        fallback: defaultCpk,
        https: true,
        insecure: true,
        certpath: 'dev/cert.json'
      },
      origin: { host: 'turtledb.com', port: 1024 }
    }
    packageJson['turtledb-com'] = overrideConfig
    packageJson.scripts ??= { start: `(export $(grep -v '^#' .env | xargs) && npx turtledb-com --config branches/${packagename}/config.json)` }
    Object.assign(packageJson, { name: packagename, author: username, license: 'GPL-3.0-or-later' })
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
    return
  } catch (error) {
    logInfo(() => console.log(`package setup failed with ${error.message}`))
    return
  }
  if (usernameArg) {
    overrideConfig.username = usernameArg
    overrideConfig.password = null
  }
  const config = getConfigFromOptions(options, overrideConfig)
  const turtleDB = await startServer(config)
  const turtleBranch = await turtleDB.makeWorkspace(config.signer, packagename)
  let value = (await turtleBranch).lookup('document', 'value') || {}
  if (typeof value !== 'object') value = {}
  if (JSON.stringify(value?.['config.json']) !== JSON.stringify(overrideConfig)) {
    logInfo(() => console.log(`committing new ${packagename}/document/value/config.json`))
    value['config.json'] = JSON.stringify(overrideConfig, null, 2)
    await turtleBranch.commit(value, 'upsert config.json')
  }

  console.log(process.env)
  try {
    const existingEnv = await readFile(envPath) // not throwing means file exists
    console.log(parse(existingEnv))
  } catch { /* throwing means there's no file to worry about overwriting */ }
  logInfo(() => console.log(`writing ${envPath}`))
  await writeFile(envPath, [
    `TURTLEDB_USERNAME="${config.username}"`,
    `TURTLEDB_PASSWORD="${config.password}"`
  ].join('\n') + '\n')

  logInfo(() => console.log(`writing ${projectPath}/package.json`))
  await writeFile(packageJsonPath, JSON.stringify({
    name: packagename,
    author: config.username,
    license: 'GPL-3.0-or-later',
    scripts: {
      start: `(export $(grep -v '^#' .env | xargs) && npx turtledb-com --config branches/${packagename}/config.json)`
    }
  }, null, 2) + '\n')
  await mkdir(branchesPath, { recursive: true })
  const { publicKey } = await config.signer.makeKeysFor(packagename)
  const publicKeyPath = join(branchesPath, `.${publicKey}`)
  try {
    await unlink(packagenamePath)
  } catch {
    // don't worry about not being able to delete what isn't there
  }
  await symlink(publicKeyPath, packagenamePath)
  logInfo(() => console.log(`project directory initialized: ${projectPath}`))
  logInfo(() => console.log(`starting server. run 'npm start' from ${projectPath} to start manually`))
  logInfo(() => console.log(`
╭──────────────────────────────────────────────────────────────────────────────────────────╮
│                                                                                          │
│  ╭─▶ \x1b[32;3m${packagenamePath}\x1b[0m${' '.repeat(Math.max(0, 84 - packagenamePath.length))}│
│  ╰────────────────────────────────╮                                                      │
│    text files in this directory ──╯  are being mirrored at this url ──╮                  │
│      ╭────────────────────────────────────────────────────────────────╯                  │
│      ╰─▶ \x1b[34;4mhttps://www.turtledb.com/${publicKey}\x1b[0m${' '.repeat(Math.max(0, 55 - publicKey.length))}│
│                                                                                          │
╰──────────────────────────────────────────────────────────────────────────────────────────╯
`))
}
