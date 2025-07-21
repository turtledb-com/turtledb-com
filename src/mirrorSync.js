import { watch } from 'chokidar'
import { lstat, readFile, unlink, writeFile } from 'fs/promises'
import { join, relative } from 'path'
import { readdirSync, readFileSync, statSync } from 'fs'
import { logDebug } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/logger.js'
import { compile } from '@gerhobbelt/gitignore-parser'

/**
 * @typedef {import('../branches/public/js/turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
 * @typedef {import('../branches/public/js/turtle/Signer.js').Signer} Signer
 * @typedef {import('../branches/public/js/turtle/Workspace.js').Workspace} Workspace
 */

const UPDATED_FILE = 'updated file'
const REMOVED_FILE = 'removed file'

/**
 * @param {string} name
 * @param {TurtleDB} turtleDB
 * @param {Signer} signer
 * @param {string} folder
 */
export async function mirrorSync (name, turtleDB, signer, folder = '.') {
  let skipCommit = false
  const workspace = signer && await turtleDB.makeWorkspace(signer, name)
  let nextTurnPromise
  const nextTurn = async () => {
    const previousPromise = nextTurnPromise
    let endTurn
    nextTurnPromise = new Promise((...args) => { [endTurn] = args })
    await previousPromise
    return endTurn
  }

  const filenamesIn = (path) => {
    return readdirSync(path).map(name => {
      const childPath = join(path, name)
      const stat = statSync(childPath)
      if (stat.isSymbolicLink()) return []
      if (stat.isDirectory()) return filenamesIn(childPath)
      return childPath
    }).flat()
  }
  const filenames = filenamesIn(folder)
  const jsobj = Object.fromEntries(filenames.map(filename => [
    filename,
    readFileSync(filename, 'utf8')
  ]))

  workspace.recaller.watch(`mirrorSync"${name}"`, async () => {
    const documentValue = workspace.lookup('document', 'value')
    console.log('(workspace recaller) documentValue', documentValue && Object.keys(documentValue))
    if (!documentValue) return
    const gitignore = compile(documentValue?.['.gitignore'] || jsobj['.gitignore'] || '')
    const jsobjKeys = Object.keys(jsobj).filter(key => gitignore.accepts(key))
    const valueKeys = Object.keys(documentValue || {}).filter(key => gitignore.accepts(key))
    if (jsobjKeys.length !== valueKeys.length || jsobjKeys.some(key => jsobj[key] !== documentValue[key])) {
      skipCommit = true
      for (const key of jsobjKeys) {
        if (!documentValue[key]) {
          await unlink(key)
        }
      }
      for (const key of valueKeys) {
        if (documentValue[key] !== jsobj[key]) {
          await writeFile(key, documentValue[key])
        }
      }
      skipCommit = false
    }
  })

  const publicKey = (await signer?.makeKeysFor?.(name))?.publicKey ?? name
  const log = (action, path) => {
    const relativePath = relative(folder, path)
    logDebug(() => console.log(`(mirrorSync) ${action} in ("${name}"): ${folder}/${relativePath}`))
  }

  const nextActionsByPath = {}
  let isHandlingChokidar
  const getPathHandlerFor = action => async path => {
    log(action, path)
    try {
      if ((await lstat(path)).isSymbolicLink()) return
    } catch (error) {
      console.log(error)
      // deleted
    }
    const isFirst = !Object.keys(nextActionsByPath).length && !isHandlingChokidar
    isHandlingChokidar = true
    const nextActionPath = relative(folder, path)
    nextActionsByPath[nextActionPath] ??= []
    const nextActions = nextActionsByPath[nextActionPath]
    nextActions.push(action)
    if (!isFirst) return
    await new Promise(resolve => setTimeout(resolve, 100)) // let chokidar cook
    const endTurn = await nextTurn()
    while (Object.keys(nextActionsByPath).length) {
      const readFilePromises = []
      for (const relativePath in nextActionsByPath) {
        const path = join(folder, relativePath)
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
      console.log('(chokidar)')
      const documentValue = workspace.lookup('document', 'value')
      const gitignore = compile(documentValue?.['.gitignore'] || jsobj['.gitignore'] || '')
      const jsobjKeys = Object.keys(jsobj).filter(key => gitignore.accepts(key))
      const valueKeys = Object.keys(documentValue || {}).filter(key => gitignore.accepts(key))
      if (jsobjKeys.length !== valueKeys.length || jsobjKeys.some(key => jsobj[key] !== documentValue[key])) {
        const newValue = {}
        for (const key of jsobjKeys) {
          if (documentValue?.[key] !== jsobj[key]) {
            console.log('change in key:', key, documentValue?.[key], jsobj[key])
          }
          newValue[key] = jsobj[key]
        }
        console.log('(chokidar) newValue', Object.keys(newValue))
        if (!skipCommit) await workspace?.commit?.(newValue, 'chokidar.watch')
        console.log('(chokidar)', { skipCommit, publicKey, jsobjKeys, valueKeys })
      }
      endTurn()
    }, 500) // delay should take longer than the commit
  }
  watch(folder, { followSymlinks: false, ignoreInitial: true })
    .on('add', getPathHandlerFor(UPDATED_FILE))
    .on('change', getPathHandlerFor(UPDATED_FILE))
    .on('unlink', getPathHandlerFor(REMOVED_FILE))
}
