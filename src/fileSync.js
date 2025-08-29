import { join, relative } from 'path'
import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { watch } from 'chokidar'
import { compile } from '@gerhobbelt/gitignore-parser'
import { BINARY_FILE, JSON_FILE, linesToString, pathToType, TEXT_FILE } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/fileTransformer.js'
import { logDebug, logError, logInfo } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/logger.js'
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
 * @param {any[string]} [ignore=[]]
 */
export async function fileSync (name, turtleDB, signer, folder = '.', ignore = []) {
  const workspace = await turtleDB.makeWorkspace(signer, name)
  const allFilenamesIn = (path) => {
    return readdirSync(path).map(file => {
      const childPath = join(path, file)
      const stat = statSync(childPath)
      if (stat.isSymbolicLink()) return []
      if (stat.isDirectory()) return allFilenamesIn(childPath)
      return childPath
    }).flat()
  }
  const readFileAsType = (filename) => {
    const type = pathToType(filename)
    if (type === JSON_FILE) {
      return JSON.parse(readFileSync(filename, 'utf8'))
    } else if (type === TEXT_FILE) {
      return readFileSync(filename, 'utf8').split('\n')
    } else if (type === BINARY_FILE) {
      return new Uint8Array(readFileSync(filename))
    }
  }
  const writeFileAsType = (filename, content) => {
    const type = pathToType(filename)
    if (type === JSON_FILE) {
      writeFileSync(filename, JSON.stringify(content, null, 2))
    } else if (type === TEXT_FILE) {
      writeFileSync(filename, content.join('\n'))
    } else if (type === BINARY_FILE) {
      writeFileSync(filename, Buffer.from(content))
    }
  }
  const fileState = Object.fromEntries(
    allFilenamesIn(folder).map(filename =>
      [filename, readFileAsType(filename)]
    )
  )

  let timeout
  const actionsByPath = new Map()
  const getPathHandlerFor = action => async path => {
    const relativePath = relative(folder, path)
    actionsByPath.set(relativePath, action)
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      for (const [path, action] of actionsByPath) {
        logDebug(() => console.log(`(fileSync) ${action} in ("${name}"): ${relativePath}`))
        if (action === UPDATED_FILE) {
          try {
            fileState[path] = readFileAsType(join(folder, path))
          } catch (error) {
            logError(() => console.error(`Error reading file "${path}" so assuming deletion:`, error))
            delete fileState[path]
          }
        } else if (action === REMOVED_FILE) {
          delete fileState[path]
        }
      }
      const events = `{${Array.from(actionsByPath.entries().map(([path, action]) => `[${action}]: "${path}"`)).join(', ')}}`
      actionsByPath.clear()
      const documentValue = workspace.lookup('document', 'value') || {}
      const gitignoreContent = linesToString(documentValue?.['.gitignore']) || ''
      const gitignore = compile(gitignoreContent)
      const fileStateKeys = Object.keys(fileState).filter(key => gitignore.accepts(key))
      const valueKeys = Object.keys(documentValue || {}).filter(key => gitignore.accepts(key))
      let changed = false
      for (const key of fileStateKeys) {
        if (!deepEqual(documentValue[key], fileState[key])) {
          documentValue[key] = fileState[key]
          changed = true
        }
      }
      for (const key of valueKeys) {
        if (!(key in fileState)) {
          delete documentValue[key]
          changed = true
        }
      }
      if (!changed) {
        logInfo(() => console.log(`(fileSync) no changes to commit in "${name}"`))
        return
      }
      logInfo(() => console.log(`(fileSync) committing changes due to event(s) ${events} in "${name}"`))
      workspace.commit(documentValue, `chokidar watch event(s) ${events} in "${name}"`)
    }, 500)
  }

  watch(folder, { followSymlinks: false, ignoreInitial: true })
    .on('add', getPathHandlerFor(UPDATED_FILE))
    .on('change', getPathHandlerFor(UPDATED_FILE))
    .on('unlink', getPathHandlerFor(REMOVED_FILE))

  // workspace.recaller.debug = true
  workspace.recaller.watch(`fileSync"${name}"`, async () => {
    const documentValue = workspace.committedBranch.lookup('document', 'value')
    const gitignoreContent = linesToString(documentValue?.['.gitignore'] || fileState['.gitignore']) || ''
    const gitignore = compile(gitignoreContent)
    const fileStateKeys = Object.keys(fileState).filter(key => gitignore.accepts(key))
    const valueKeys = Object.keys(documentValue || {}).filter(key => gitignore.accepts(key))
    console.log({ fileStateKeys, valueKeys })
    if (workspace.committedBranch.index >= 0) {
      for (const key of fileStateKeys) {
        if (!(key in documentValue)) {
          console.log('deleting', key)
          try {
            unlinkSync(key)
          } catch (error) {
            if (error.code !== 'ENOENT') throw error
          }
        }
      }
      for (const key of valueKeys) {
        if (!deepEqual(documentValue[key], fileState[key])) {
          console.log('rewriting', key)
          writeFileAsType(key, documentValue[key])
        }
      }
    } else if (fileStateKeys.length === 0) {
      await workspace.commit(Object.fromEntries(fileStateKeys.map(key => [key, fileState[key]])), 'initial')
    }
  })

  return workspace
}
