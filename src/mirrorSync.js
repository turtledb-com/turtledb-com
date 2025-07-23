import { watch } from 'chokidar'
import { lstat, readFile, unlink, writeFile } from 'fs/promises'
import { join, relative } from 'path'
import { readdirSync, readFileSync, statSync } from 'fs'
import { logDebug, logError } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/logger.js'
import { compile } from '@gerhobbelt/gitignore-parser'
import { BINARY_FILE, JSON_FILE, linesToString, pathToType, TEXT_FILE } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/fileTransformer.js'
import { deepEqual } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/deepEqual.js'

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
  const jsobj = Object.fromEntries(filenames.map(filename => {
    const type = pathToType(filename)
    let file = readFileSync(filename, type === BINARY_FILE ? {} : 'utf8')
    if (type === JSON_FILE) file = JSON.parse(file)
    else if (type === TEXT_FILE) file = file.split('\n')
    console.log('=> transformed =>', filename, type, typeof file, file.constructor.name)
    return [filename, file]
  }))
  // console.log(jsobj)

  workspace.recaller.watch(`mirrorSync"${name}"`, async () => {
    const documentValue = workspace.lookup('document', 'value')
    console.log('(workspace recaller) documentValue', documentValue && Object.keys(documentValue))
    if (!documentValue) return
    const gitignoreContent = linesToString(documentValue?.['.gitignore'] || jsobj['.gitignore']) || ''
    const gitignore = compile(gitignoreContent)
    console.log('(workspace recaller)', { gitignoreContent })
    const jsobjKeys = Object.keys(jsobj).filter(key => gitignore.accepts(key))
    const valueKeys = Object.keys(documentValue || {}).filter(key => gitignore.accepts(key))
    if (!deepEqual(documentValue, jsobj)) {
      skipCommit = true
      for (const key of jsobjKeys) {
        if (!documentValue[key]) {
          try {
            console.log('DELETING', key)
            await unlink(key)
          } catch (error) {
            logError(() => console.error(error))
          }
        }
      }
      for (const key of valueKeys) {
        if (!deepEqual(documentValue[key], jsobj[key])) {
          console.log('(workspace recaller) ∆', key, documentValue[key], jsobj[key])
          const type = pathToType(key)
          try {
            if (type === TEXT_FILE) await writeFile(key, documentValue[key].join('\n'))
            else if (type === JSON_FILE) await writeFile(key, JSON.stringify(documentValue[key], null, 2))
            else await writeFile(key, documentValue[key], 'binary')
          } catch (error) {
            logError(() => console.error(error))
          }
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
          const type = pathToType(path)
          if (type === JSON_FILE) {
            readFilePromises.push(readFile(path, 'utf8').then(file => {
              jsobj[relativePath] = JSON.parse(file)
            }))
          } else if (type === TEXT_FILE) {
            readFilePromises.push(readFile(path, 'utf8').then(file => {
              jsobj[relativePath] = file.split('\n')
            }))
          } else {
            readFilePromises.push(readFile(path, 'binary').then(file => {
              jsobj[relativePath] = file
            }))
          }
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
      const gitignoreContent = linesToString(documentValue?.['.gitignore'] || jsobj['.gitignore']) || ''
      const gitignore = compile(gitignoreContent)
      console.log('(chokidar)', { gitignoreContent })
      const jsobjKeys = Object.keys(jsobj).filter(key => gitignore.accepts(key))
      const valueKeys = Object.keys(documentValue || {}).filter(key => gitignore.accepts(key))
      const newValue = {}
      let changed = false
      for (const key of jsobjKeys) {
        if (!deepEqual(documentValue?.[key], jsobj[key])) {
          changed = true
          console.log('change in key:', key, documentValue?.[key], jsobj[key])
        }
        newValue[key] = jsobj[key]
      }
      if (changed) {
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
