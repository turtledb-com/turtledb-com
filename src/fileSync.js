import { dirname, join, relative } from 'path'
import { mkdirSync, read, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { watch } from 'chokidar'
import { compile } from '@gerhobbelt/gitignore-parser'
import { BINARY_FILE, JSON_FILE, linesToString, pathToType, TEXT_FILE } from '../public/js/utils/fileTransformer.js'
import { logDebug, logError, logFatal, logInfo } from '../public/js/utils/logger.js'
import { deepEqual } from '../public/js/utils/deepEqual.js'
import { OURS, THEIRS, THROW } from '../public/js/turtle/TurtleDictionary.js'

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
export async function fileSync (name, turtleDB, signer, folder = '.', resolve = THROW) {
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
      const content = readFileSync(filename, 'utf8')
      try {
        return JSON.parse(content)
      } catch (error) {
        logError(() => console.error(`Error parsing JSON file "${filename}", returning raw text instead:`, error))
        return content
      }
    } else if (type === TEXT_FILE) {
      return readFileSync(filename, 'utf8').split('\n')
    } else if (type === BINARY_FILE) {
      return new Uint8Array(readFileSync(filename))
    }
  }
  const writeFileAsType = (filename, content) => {
    const foldername = dirname(filename)
    if (foldername.length) mkdirSync(foldername, { recursive: true })
    const type = pathToType(filename)
    if (typeof content === 'string') {
      writeFileSync(filename, content)
    } else if (type === JSON_FILE) {
      writeFileSync(filename, JSON.stringify(content, null, 2))
    } else if (type === TEXT_FILE) {
      writeFileSync(filename, content.join('\n'))
    } else if (type === BINARY_FILE) {
      writeFileSync(filename, Buffer.from(content))
    }
  }
  const fsFilesObject = Object.fromEntries(
    allFilenamesIn(folder).map(filename =>
      [filename, readFileAsType(filename)]
    )
  )

  const gitFilterFilesObject = (filesObject = {}) => {
    const gitignoreContent = linesToString(filesObject['.gitignore']) || ''
    const gitignore = compile(gitignoreContent)
    const filteredKeys = Object.keys(filesObject).filter(key => gitignore.accepts(key) && !/^__turtledb_/.test(key))
    return Object.fromEntries(filteredKeys.map(key => [key, filesObject[key]]))
  }

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
            fsFilesObject[path] = readFileAsType(join(folder, path))
          } catch (error) {
            logError(() => console.error(`Error reading file "${path}" so assuming deletion:`, error))
            delete fsFilesObject[path]
          }
        } else if (action === REMOVED_FILE) {
          delete fsFilesObject[path]
        }
      }
      const events = `{${Array.from(actionsByPath.entries().map(([path, action]) => `[${action}]: "${path}"`)).join(', ')}}`
      actionsByPath.clear()
      const documentValue = workspace.lookup('document', 'value') || {}

      const filteredDocumentValue = gitFilterFilesObject(documentValue)
      const filteredFsFilesObject = gitFilterFilesObject(fsFilesObject)

      let changed = false
      for (const key in filteredFsFilesObject) {
        if (!deepEqual(documentValue[key], filteredFsFilesObject[key])) {
          documentValue[key] = filteredFsFilesObject[key]
          changed = true
        }
      }
      for (const key in filteredDocumentValue) {
        if (!(key in filteredFsFilesObject)) {
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

  let firstRun = true
  // workspace.recaller.debug = true
  workspace.recaller.watch(`fileSync"${name}"`, async () => {
    const committedDocumentValue = workspace.committedBranch.lookup('document', 'value') || {}
    const filteredCommittedDocumentValue = gitFilterFilesObject(committedDocumentValue)
    if (!fsFilesObject['.gitignore'] && firstRun) {
      fsFilesObject['.gitignore'] = filteredCommittedDocumentValue?.['.gitignore'] || ['.env', '.DS_Store', '']
      writeFileAsType('.gitignore', fsFilesObject['.gitignore'])
    }
    const filteredFsFilesObject = gitFilterFilesObject(fsFilesObject)
    if (workspace.committedBranch.index >= 0) {
      let touched = false
      for (const key in filteredFsFilesObject) {
        if (!(key in filteredCommittedDocumentValue)) {
          if (firstRun) {
            if (resolve === OURS) {
              committedDocumentValue[key] = filteredFsFilesObject[key]
              touched = true
            } else if (resolve === THEIRS) {
              delete fsFilesObject[key]
              try {
                unlinkSync(key)
                let dir = dirname(key)
                while (dir !== '.' && dir !== '/' && readdirSync(dir).length === 0) {
                  rmSync(dir, { recursive: true, force: true })
                  dir = dirname(dir)
                }
              } catch (error) {
                if (error.code !== 'ENOENT') throw error
              }
            } else if (resolve === THROW) {
              logFatal(() => console.error(`file "${key}" present in file system but not in TurtleDB, please delete the file or remove it from .gitignore and recommit`))
              throw new Error(`file "${key}" present in file system but not in TurtleDB, please delete the file or remove it from .gitignore and recommit`)
            }
          } else {
            try {
              delete fsFilesObject[key]
              unlinkSync(key)
              let dir = dirname(key)
              while (dir !== '.' && dir !== '/' && readdirSync(dir).length === 0) {
                rmSync(dir, { recursive: true, force: true })
                dir = dirname(dir)
              }
            } catch (error) {
              if (error.code !== 'ENOENT') throw error
            }
          }
        }
      }
      for (const key in filteredCommittedDocumentValue) {
        if (!deepEqual(filteredCommittedDocumentValue[key], filteredFsFilesObject[key])) {
          if (firstRun) {
            if (resolve === OURS) {
              if (key in filteredFsFilesObject) {
                committedDocumentValue[key] = filteredFsFilesObject[key]
              } else {
                delete committedDocumentValue[key]
              }
              touched = true
            } else if (resolve === THEIRS) {
              fsFilesObject[key] = filteredCommittedDocumentValue[key]
              writeFileAsType(key, filteredCommittedDocumentValue[key])
            } else if (resolve === THROW) {
              logFatal(() => console.error(`file "${key}" present in TurtleDB but different in file system, please update the file or remove it from .gitignore and recommit`))
              throw new Error(`file "${key}" present in TurtleDB but different in file system, please update the file or remove it from .gitignore and recommit`)
            }
          }
        }
      }
      if (touched) {
        await workspace.commit(committedDocumentValue, 'reolved conflict commit from fileSync')
      }
    } else {
      await workspace.commit(filteredFsFilesObject, 'initial commit from fileSync')
    }
    if (firstRun) {
      watch(folder, { followSymlinks: false, ignoreInitial: true })
        .on('add', getPathHandlerFor(UPDATED_FILE))
        .on('change', getPathHandlerFor(UPDATED_FILE))
        .on('unlink', getPathHandlerFor(REMOVED_FILE))
    }
    firstRun = false
  })

  return workspace
}
