import { join, relative } from 'path'
import { readdirSync, readFileSync, statSync } from 'fs'
import { lstat, readFile, unlink, writeFile } from 'fs/promises'
import { watch } from 'chokidar'
import { compile } from '@gerhobbelt/gitignore-parser'
import { logDebug, logError } from '../public/js/utils/logger.js'
import { BINARY_FILE, JSON_FILE, linesToString, pathToType, TEXT_FILE } from '../public/js/utils/fileTransformer.js'
import { deepEqual } from '../public/js/utils/deepEqual.js'
import { AS_REFS } from '../public/js/turtle/codecs/CodecType.js'
import { OPAQUE_UINT8ARRAY } from '../public/js/turtle/codecs/codec.js'

/**
 * @typedef {import('../public/js/turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
 * @typedef {import('../public/js/turtle/Signer.js').Signer} Signer
 * @typedef {import('../public/js/turtle/Workspace.js').Workspace} Workspace
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
  let lastCommit
  const workspace = signer && await turtleDB.makeWorkspace(signer, name)
  let nextTurnPromise
  const nextTurn = async () => {
    const previousPromise = nextTurnPromise
    let endTurn
    nextTurnPromise = new Promise((...args) => { [endTurn] = args })
    await previousPromise
    return endTurn
  }

  const allFilenamesIn = (path) => {
    return readdirSync(path).map(name => {
      const childPath = join(path, name)
      const stat = statSync(childPath)
      if (stat.isSymbolicLink()) return []
      if (stat.isDirectory()) return allFilenamesIn(childPath)
      return childPath
    }).flat()
  }
  const filenames = allFilenamesIn(folder)
  const jsobj = Object.fromEntries(filenames.map(filename => {
    const type = pathToType(filename)
    let file
    if (type === JSON_FILE) {
      file = JSON.parse(readFileSync(filename, 'utf8'))
    } else if (type === TEXT_FILE) {
      file = readFileSync(filename, 'utf8').split('\n')
    } else if (type === BINARY_FILE) {
      file = new Uint8Array(readFileSync(filename))
    }
    return [filename, file]
  }))

  workspace.recaller.watch(`mirrorSync"${name}"`, async () => {
    const endTurn = await nextTurn()
    console.log('(workspace.recaller watch) VVVVV queueing update', name)
    const documentValue = workspace.lookup('document', 'value')
    if (!documentValue) return endTurn()
    const gitignoreContent = linesToString(documentValue?.['.gitignore'] || jsobj['.gitignore']) || ''
    const gitignore = compile(gitignoreContent)
    const jsobjKeys = Object.keys(jsobj).filter(key => gitignore.accepts(key))
    const valueKeys = Object.keys(documentValue || {}).filter(key => gitignore.accepts(key))
    if (!deepEqual(documentValue, jsobj)) {
      skipCommit = true
      for (const key of jsobjKeys) {
        if (!documentValue[key]) {
          try {
            console.log('--- deleting (recaller)', key)
            await unlink(key)
          } catch (error) {
            logError(() => console.error(error))
          }
        }
      }
      for (const key of valueKeys) {
        if (!deepEqual(documentValue[key], jsobj[key])) {
          const type = pathToType(key)
          try {
            if (type === JSON_FILE) {
              await writeFile(key, JSON.stringify(documentValue[key], null, 2))
            } else if (type === TEXT_FILE) {
              await writeFile(key, documentValue[key].join('\n'))
            } else {
              await writeFile(key, documentValue[key])
            }
          } catch (error) {
            logError(() => console.error(error))
          }
        }
      }
      skipCommit = false
    }
    console.log('(workspace.recaller watch) AAAAA completing update', name)
    endTurn()
  })

  const log = (action, path) => {
    const relativePath = relative(folder, path)
    logDebug(() => console.log(`(mirrorSync) ${action} in ("${name}"): ${folder}/${relativePath}`))
  }

  const nextActionsByPath = {}
  let isHandlingChokidar
  const getPathHandlerFor = action => async path => {
    log(action, path)
    await lastCommit
    const endTurn = await nextTurn()
    console.log('(chokidar watch) vvvvv queueing update', action, path)
    try {
      if ((await lstat(path)).isSymbolicLink()) return endTurn()
    } catch (error) { /* deleted */ }
    const isFirst = !Object.keys(nextActionsByPath).length && !isHandlingChokidar
    isHandlingChokidar = true
    const nextActionPath = relative(folder, path)
    nextActionsByPath[nextActionPath] ??= []
    const nextActions = nextActionsByPath[nextActionPath]
    nextActions.push(action)
    if (!isFirst) return endTurn()
    await new Promise(resolve => setTimeout(resolve, 100)) // let chokidar cook
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
            readFilePromises.push(readFile(path).then(file => {
              jsobj[relativePath] = new Uint8Array(file)
            }))
          }
        } else if (action === REMOVED_FILE) {
          console.log('=== deleting (chokidar) from jsobj', relativePath)
          delete jsobj[relativePath]
        }
      }
      await Promise.all(readFilePromises)
    }
    isHandlingChokidar = false

    setTimeout(async () => {
      const documentValue = workspace.lookup('document', 'value')
      const gitignoreContent = linesToString(documentValue?.['.gitignore'] || jsobj['.gitignore']) || ''
      console.log({ gitignoreContent })
      const gitignore = compile(gitignoreContent)
      const jsobjKeys = Object.keys(jsobj).filter(key => gitignore.accepts(key))
      const newValueRefs = {}
      let changed = false
      for (const key of jsobjKeys) {
        const jsobjValue = jsobj[key]
        if (!deepEqual(documentValue?.[key], jsobjValue)) changed = true
        if (jsobjValue instanceof Uint8Array) {
          newValueRefs[key] = workspace.upsert(jsobjValue, [OPAQUE_UINT8ARRAY])
          console.log('--- upserting (chokidar)', key, newValueRefs[key])
        } else {
          newValueRefs[key] = workspace.upsert(jsobjValue)
        }
      }
      if (changed) {
        const ref = workspace.upsert(newValueRefs, undefined, AS_REFS)
        if (!skipCommit) {
          lastCommit = workspace?.commit?.(ref, 'chokidar.watch', true)
          await lastCommit
        }
      } else {
        console.log('NO CHANGE (chokidar)')
      }
      console.log('(chokidar watch) ^^^^^ completing update', action, path, { changed })
      endTurn()
    }, 500) // delay should take longer than the commit
  }
  watch(folder, { followSymlinks: false, ignoreInitial: true })
    .on('add', getPathHandlerFor(UPDATED_FILE))
    .on('change', getPathHandlerFor(UPDATED_FILE))
    .on('unlink', getPathHandlerFor(REMOVED_FILE))
}
