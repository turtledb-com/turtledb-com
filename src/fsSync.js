import { watch } from 'chokidar'
import { lstat, mkdir, readFile, symlink, unlink, writeFile } from 'fs/promises'
import { dirname, join, relative } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { logDebug, logError } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/logger.js'

/**
 * @typedef {import('../branches/public/js/turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
 * @typedef {import('../branches/public/js/turtle/Signer.js').Signer} Signer
 * @typedef {import('../branches/public/js/turtle/Workspace.js').Workspace} Workspace
 */

export const ignored = /(?:\/node_modules\b|.*\.ico$|\.lock$|~$)/i

const UPDATED_FILE = 'updated file'
const REMOVED_FILE = 'removed file'

/**
 * @param {string} name
 * @param {TurtleDB} turtleDB
 * @param {Signer} signer
 * @param {string} folder
 */
export async function fsSync (name, turtleDB, signer, folder) {
  let skipCommit = false
  let nextTurnPromise
  const nextTurn = async () => {
    const previousPromise = nextTurnPromise
    let endTurn
    nextTurnPromise = new Promise((...args) => { [endTurn] = args })
    await previousPromise
    return endTurn
  }
  let jsobj = {}
  let lastJsobj = {}
  let turtleBranch
  let publicKey
  let publicKeyFolder
  const log = (action, path) => {
    const relativePath = relative(publicKeyFolder, path)
    logDebug(() => console.log(`(fsSync) ${action} ${publicKeyFolder} ("${name}") / ${relativePath}`))
  }
  if (signer) {
    const workspace = await turtleDB.makeWorkspace(signer, name)
    turtleBranch = workspace.committedBranch
    publicKey = (await signer.makeKeysFor(name)).publicKey
    publicKeyFolder = join(folder, `.${publicKey}`)
    const nextActionsByPath = {}
    let isHandlingChokidar
    const getPathHandlerFor = action => async path => {
      log(action, path)
      try {
        if ((await lstat(path)).isSymbolicLink()) return
      } catch (error) {
        console.error(error) // it's probably not there
      }
      const isFirst = !Object.keys(nextActionsByPath).length && !isHandlingChokidar
      isHandlingChokidar = true
      const relativePath = relative(publicKeyFolder, path)
      nextActionsByPath[relativePath] ??= []
      const nextActions = nextActionsByPath[relativePath]
      nextActions.push(action)
      if (!isFirst) return
      await new Promise(resolve => setTimeout(resolve, 100)) // let chokidar cook
      const endTurn = await nextTurn()
      while (Object.keys(nextActionsByPath).length) {
        const readFilePromises = []
        for (const relativePath in nextActionsByPath) {
          const path = join(publicKeyFolder, relativePath)
          const action = nextActionsByPath[relativePath].pop()
          delete nextActionsByPath[relativePath]
          if (action === UPDATED_FILE) {
            readFilePromises.push(readFile(path, 'utf8').then(file => { jsobj[relativePath] = file }))
          } else if (action === REMOVED_FILE) {
            delete jsobj[relativePath]
          }
        }
        await Promise.all(readFilePromises)
      }
      isHandlingChokidar = false

      setTimeout(async () => {
        if (!skipCommit) {
          if (Object.keys(jsobj).length !== Object.keys(lastJsobj).length || Object.keys(jsobj).some(key => jsobj[key] !== lastJsobj[key])) {
            lastJsobj = Object.assign({}, jsobj)
            await workspace.commit(jsobj, 'chokidar.watch')
          } else {
            log('no changed files', publicKeyFolder)
          }
        }
        endTurn()
      }, 500) // delay should take longer than the commit
    }
    watch(publicKeyFolder, { ignored, followSymlinks: false })
      .on('add', getPathHandlerFor(UPDATED_FILE))
      .on('change', getPathHandlerFor(UPDATED_FILE))
      .on('unlink', getPathHandlerFor(REMOVED_FILE))
  } else {
    turtleBranch = await turtleDB.summonBoundTurtleBranch(name)
    publicKey = name
    publicKeyFolder = join(folder, `.${publicKey}`)
  }
  if (!existsSync(folder)) mkdirSync(folder)
  if (!existsSync(publicKeyFolder)) mkdirSync(publicKeyFolder)

  turtleBranch.recaller.watch(`fsSync"${publicKey}"`, async () => {
    skipCommit = true
    turtleBranch.lookup() // tell recaller to watch turtleBranch changes
    const endTurn = await nextTurn()
    const newJsobj = turtleBranch.lookup('document', 'value')
    if (newJsobj) {
      const changes = []
      for (const relativePath in jsobj) {
        const path = join(publicKeyFolder, relativePath)
        if (newJsobj[relativePath] === undefined) {
          log('change: file removed', path)
          changes.push(unlink(path))
        }
      }
      for (const relativePath in newJsobj) {
        const path = join(publicKeyFolder, relativePath)
        if (newJsobj[relativePath] !== jsobj[relativePath]) {
          log('change: file added', path)
          changes.push(mkdir(dirname(path), { recursive: true }).then(async () => {
            // make sure it's a string
            const data = newJsobj[relativePath]
            if (typeof data !== 'string') {
              logError(() => console.error(`files must be strings, ${publicKey} / ${relativePath} has type: ${typeof value}`))
              return
            }
            writeFile(path, data)
            if (relativePath === 'config.json') {
              try {
                const config = JSON.parse(data)
                for (const fsType of ['fsReadWrite', 'fsReadOnly']) {
                  for (const { name, key } of config[fsType] || []) {
                    if (name && key && key !== publicKey) {
                      const keyPath = join('..', `.${key}`)
                      const namePath = join(publicKeyFolder, name)
                      try {
                        await unlink(namePath)
                      } catch {
                      // don't worry about not deleting what isn't there
                      }
                      await symlink(keyPath, namePath)
                    }
                  }
                }
              } catch (err) {
                logError(() => {
                  console.log('unable to create symlinks')
                  console.error(err)
                })
              }
            }
          }))
        }
      }
      if (changes.length) log(`${changes.length} changes`, publicKeyFolder)
      await Promise.all(changes)
      jsobj = newJsobj
      lastJsobj = Object.assign({}, jsobj)
    }
    skipCommit = false
    endTurn()
  })
}
