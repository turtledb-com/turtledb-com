import { dirname, join, relative } from 'path'
import { mkdirSync, read, readdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'fs'
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

const gitFilterFilesObject = (fsFilesObject = {}, turtleDBFolder = '.turtleDB', gitignoreContent) => {
  gitignoreContent = linesToString(gitignoreContent || fsFilesObject['.gitignore'] || ['.env', '.DS_Store'])
  const gitignore = compile(gitignoreContent)
  const filteredKeys = Object.keys(fsFilesObject).filter(key => gitignore.accepts(key) && !key.startsWith(turtleDBFolder + '/'))
  return Object.fromEntries(filteredKeys.map(key => [key, fsFilesObject[key]]))
}

const allFilenamesIn = (path, cwd = '.') => {
  return readdirSync(join(cwd, path)).map(file => {
    const childPath = join(path, file)
    const stat = statSync(join(cwd, childPath))
    if (stat.isSymbolicLink()) return []
    if (stat.isDirectory()) return allFilenamesIn(childPath, cwd)
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

const readFolder = folder => Object.fromEntries(
  allFilenamesIn(folder).map(filename =>
    [filename, readFileAsType(filename)]
  )
)
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

const deleteFile = filename => {
  try {
    unlinkSync(filename)
    let dir = dirname(filename)
    while (dir !== '.' && dir !== '/' && readdirSync(dir).length === 0) {
      rmSync(dir, { recursive: true, force: true })
      dir = dirname(dir)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

const setFsToValue = (newFilesObject, oldFilesObject, cwd, turtleDBFolder = '.turtleDB') => {
  const filteredNewFilesObject = gitFilterFilesObject(newFilesObject, turtleDBFolder)
  const filteredFsFilesObject = gitFilterFilesObject(readFolder(cwd), turtleDBFolder, filteredNewFilesObject['.gitignore'])
  for (const key in filteredFsFilesObject) {
    if (!(key in filteredNewFilesObject)) {
      deleteFile(join(cwd, key))
      delete oldFilesObject[key]
    }
  }
  for (const key in filteredNewFilesObject) {
    if (!deepEqual(filteredNewFilesObject[key], filteredFsFilesObject[key])) {
      writeFileAsType(join(cwd, key), filteredNewFilesObject[key])
      oldFilesObject[key] = filteredNewFilesObject[key]
    }
  }
}

export async function clobberFolder (turtleBranch, folder = '.', turtleDBFolder = '.turtleDB') {
  let timeout
  const handleFileChange = () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      setFsToValue(turtleBranch.lookup('document', 'value') || {}, readFolder(folder), folder, turtleDBFolder)
    }, 500)
  }
  watch(folder, { followSymlinks: false, ignoreInitial: true })
    .on('add', handleFileChange)
    .on('change', handleFileChange)
    .on('unlink', handleFileChange)
  turtleBranch.recaller.watch(`fileSync"${turtleBranch.name}"`, async () => {
    setFsToValue(turtleBranch.lookup('document', 'value') || {}, readFolder(folder), folder, turtleDBFolder)
  })
}

/**
 * @param {string} name
 * @param {TurtleDB} turtleDB
 * @param {Signer} signer
 * @param {string} folder
 * @param {string} resolve
 * @param {string} turtleDBFolder
 * @returns {Promise<Workspace>}
 */
export async function fileSync (name, turtleDB, signer, folder = '.', resolve = THROW, turtleDBFolder = '.turtleDB') {
  const workspace = await turtleDB.makeWorkspace(signer, name)
  const fsFilesObject = readFolder(folder)

  let timeout
  const actionsByPath = new Map()
  const getPathHandlerFor = action => async path => {
    const relativePath = relative(folder, path)
    actionsByPath.set(relativePath, action)
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      for (const [path, action] of actionsByPath) {
        logDebug(() => console.log(`(fileSync) ${action} in ("${name}"): ${path}`))
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

      const filteredDocumentValue = gitFilterFilesObject(documentValue, turtleDBFolder)
      const filteredFsFilesObject = gitFilterFilesObject(fsFilesObject, turtleDBFolder)

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
      if (changed) {
        logInfo(() => console.log(`(fileSync) committing changes due to event(s) ${events} in "${name}"`))
        workspace.commit(documentValue, `chokidar watch event(s) ${events} in "${name}"`)
      } else {
        logInfo(() => console.log(`(fileSync) no changes to commit in "${name}"`))
      }
    }, 500)
  }
  watch(folder, { followSymlinks: false, ignoreInitial: true })
    .on('add', getPathHandlerFor(UPDATED_FILE))
    .on('change', getPathHandlerFor(UPDATED_FILE))
    .on('unlink', getPathHandlerFor(REMOVED_FILE))

  let firstRun = true
  // workspace.recaller.debug = true
  workspace.recaller.watch(`fileSync"${name}"`, async () => {
    const committedDocumentValue = workspace.committedBranch.lookup('document', 'value') || {}
    const filteredCommittedDocumentValue = gitFilterFilesObject(committedDocumentValue, turtleDBFolder)
    if (!fsFilesObject['.gitignore'] && firstRun) {
      fsFilesObject['.gitignore'] = filteredCommittedDocumentValue?.['.gitignore'] || ['.turtleDB', '.env', '.DS_Store', '']
      writeFileAsType(join(folder, '.gitignore'), fsFilesObject['.gitignore'])
    }
    const filteredFsFilesObject = gitFilterFilesObject(fsFilesObject, turtleDBFolder)
    if (filteredFsFilesObject['package.json']) {
      const packageJson = workspace.lookup('document', 'value', 'package.json')
      const dependencies = packageJson?.turtleDB?.dependencies || {}
      for (const name in dependencies) {
        const modulePublicKey = dependencies[name]
        const moduleFolder = join(folder, '__turtledb_modules__', modulePublicKey)
        try {
          mkdirSync(moduleFolder, { recursive: true })
        } catch (error) {
          if (error.code !== 'EEXIST') logError(() => console.error(error))
        }
        const symlinkFolder = join(folder, name)
        try {
          symlinkSync(moduleFolder, symlinkFolder, 'dir')
        } catch (error) {
          if (error.code !== 'EEXIST') logError(() => console.error(error))
        }
        const turtleBranch = await turtleDB.summonBoundTurtleBranch(modulePublicKey)
        clobberFolder(turtleBranch, moduleFolder, turtleDBFolder)
      }
    }
    if (workspace.committedBranch.index >= 0) {
      if (firstRun || resolve === THEIRS) {
        setFsToValue(committedDocumentValue, fsFilesObject, folder, turtleDBFolder)
      } else if (resolve === OURS) {
        let touched = false
        for (const key in filteredFsFilesObject) {
          if (!(key in filteredCommittedDocumentValue)) {
            committedDocumentValue[key] = filteredFsFilesObject[key]
            touched = true
          }
        }
        for (const key in filteredCommittedDocumentValue) {
          if (!deepEqual(filteredCommittedDocumentValue[key], filteredFsFilesObject[key])) {
            if (key in filteredFsFilesObject) {
              committedDocumentValue[key] = filteredFsFilesObject[key]
            } else {
              delete committedDocumentValue[key]
            }
            touched = true
          }
        }
        if (touched) {
          await workspace.commit(committedDocumentValue, 'resolved conflict commit from fileSync')
        }
      } else {
        for (const key in filteredFsFilesObject) {
          if (!(key in filteredCommittedDocumentValue)) {
            logFatal(() => console.error(`file "${key}" present in file system but not in TurtleDB, please use "--fs-mirror theirs" to delete the file or "--fs-mirror ours" to commit the file`))
            throw new Error(`file "${key}" present in file system but not in TurtleDB, please use "--fs-mirror theirs" to delete the file or "--fs-mirror ours" to commit the file`)
          }
        }
        for (const key in filteredCommittedDocumentValue) {
          if (!deepEqual(filteredCommittedDocumentValue[key], filteredFsFilesObject[key])) {
            logFatal(() => console.error(`file "${key}" present in TurtleDB but different in file system, please use "--fs-mirror theirs" to overwrite local changes or "--fs-mirror ours" to commit local changes`))
            throw new Error(`file "${key}" present in TurtleDB but different in file system, please use "--fs-mirror theirs" to overwrite local changes or "--fs-mirror ours" to commit local changes`)
          }
        }
      }
    } else {
      await workspace.commit(filteredFsFilesObject, 'initial commit from fileSync')
    }
    firstRun = false
  })

  return workspace
}
