import { dirname, join, relative } from 'path'
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync, readlinkSync, lstatSync, read } from 'fs'
import { watch } from 'chokidar'
import { compile } from '@gerhobbelt/gitignore-parser'
import { BINARY_FILE, JSON_FILE, linesToString, pathToType, TEXT_FILE } from '../public/js/utils/fileTransformer.js'
import { logDebug, logError, logFatal, logInfo } from '../public/js/utils/logger.js'
import { deepEqual } from '../public/js/utils/deepEqual.js'
import { OURS, THEIRS, THROW } from '../public/js/turtle/TurtleDictionary.js'
import { proxyFolder } from './proxyFolder.js'

/**
 * @typedef {import('../public/js/turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
 * @typedef {import('../public/js/turtle/Signer.js').Signer} Signer
 * @typedef {import('../public/js/turtle/Workspace.js').Workspace} Workspace
 */

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

  const gitFilter = (fsFilesObject = {}, gitignoreContent) => {
    gitignoreContent = linesToString(gitignoreContent || fsFilesObject['.gitignore'] || ['.env', '.DS_Store'])
    const gitignore = compile(gitignoreContent)
    const filteredKeys = Object.keys(fsFilesObject).filter(key => gitignore.accepts(key) && !key.startsWith(turtleDBFolder + '/'))
    return Object.fromEntries(filteredKeys.sort().map(key => [key, fsFilesObject[key]]))
  }

  const syncFoldersBySymlink = {}
  let firstRun = true

  const update = (path, oldEntity, newEntity) => {
    const oldSymlink = oldEntity?.symlink
    const newSymlink = newEntity?.symlink
    if (oldSymlink) {
      if (!syncFoldersBySymlink[oldSymlink]) throw new Error(`unexpected old symlink "${oldSymlink}" not being tracked`)
      if (oldSymlink === newSymlink) return
      const { count, unsync } = syncFoldersBySymlink[oldSymlink] || {}
      if (count > 0) {
        --syncFoldersBySymlink[oldSymlink].count
      } else {
        unsync?.()
        delete syncFoldersBySymlink[oldSymlink]
      }
    }
    if (newSymlink) {
      if (!syncFoldersBySymlink[newSymlink]) {
        let unsync = async () => {
          unsync = null
        }
        (async () => {
          const publicKey = newSymlink.match(/\/([0-9a-z]{40,50})$/)?.[1]
          console.log({ newSymlink, publicKey })
          // const turtleBranch = await turtleDB.summonBoundTurtleBranch(publicKey)
          // unsync &&= await syncFolder(turtleBranch, newSymlink)
        })()
        syncFoldersBySymlink[newSymlink] = { count: 0, unsync }
      }
      ++syncFoldersBySymlink[newSymlink].count
    }
  }

  const folderFilesObject = proxyFolder(folder, turtleDB.recaller, update)

  workspace.recaller.watch(`fileSync "${name}" watch workspace`, () => {
    const workspaceFilesObject = workspace.lookup('document', 'value')
    const ackWorkspace = gitFilter(workspaceFilesObject)
    const ackFolder = gitFilter(folderFilesObject)
    Object.keys(ackWorkspace).forEach(key => {
      ackFolder[key] = ackWorkspace[key]
    })
    Object.keys(ackFolder).forEach(key => {
      if (!ackWorkspace[key]) delete ackFolder[key]
    })
  })

  firstRun = false

  /*
  const UPDATED_FILE = 'updated file'
  const REMOVED_FILE = 'removed file'

  async function syncFolder (turtleBranch, folder = '.', rawFsFilesObject = readFolder(folder)) {
    let timeout
    const handleFileChange = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        setFsToValue(turtleBranch.lookup('document', 'value') || {}, rawFsFilesObject, folder)
      }, 500)
    }
    const fsWatcher = watch(folder, {
      followSymlinks: false,
      ignoreInitial: true
    })
      .on('add', handleFileChange)
      .on('change', handleFileChange)
      .on('unlink', handleFileChange)

    const turtleWatcher =
      async () => {
        console.log('turtleWatcher triggered')
        setFsToValue(turtleBranch.lookup('document', 'value') || {}, rawFsFilesObject, folder)
      }
    turtleBranch.recaller.watch(`fileSync"${turtleBranch.name}"`, turtleWatcher)
    return () => {
      fsWatcher.close()
      turtleBranch.recaller.unwatch(turtleWatcher)
    }
  }

  const syncFoldersBySymlink = {}

  const updateModuleLink = (oldSymlink, newSymlink) => {
    if (oldSymlink && !syncFoldersBySymlink[oldSymlink]) {
      throw new Error(`unexpected old symlink "${oldSymlink}" not being tracked`)
    }
    if (oldSymlink && syncFoldersBySymlink[oldSymlink]) {
      if (oldSymlink === newSymlink) return
      const { count, unsync } = syncFoldersBySymlink[oldSymlink] || {}
      if (count <= 1) {
        unsync?.()
        delete syncFoldersBySymlink[oldSymlink]
      } else {
        --syncFoldersBySymlink[oldSymlink].count
      }
    }
    if (newSymlink) {
      if (!syncFoldersBySymlink[newSymlink]) {
        let unsync = async () => {
          unsync = null
        }
        (async () => {
          const publicKey = newSymlink.match(/\/([0-9a-z]{40,50})$/)?.[1]
          const turtleBranch = await turtleDB.summonBoundTurtleBranch(publicKey)
          unsync &&= await syncFolder(turtleBranch, newSymlink)
        })()
        syncFoldersBySymlink[newSymlink] = { count: 0, unsync }
      }
      ++syncFoldersBySymlink[newSymlink].count
    }
  }

  const gitFilterFilesObject = (fsFilesObject = {}, gitignoreContent) => {
    gitignoreContent = linesToString(gitignoreContent || fsFilesObject['.gitignore'] || ['.env', '.DS_Store'])
    const gitignore = compile(gitignoreContent)
    const filteredKeys = Object.keys(fsFilesObject).filter(key => gitignore.accepts(key) && !key.startsWith(turtleDBFolder + '/'))
    return Object.fromEntries(filteredKeys.map(key => [key, fsFilesObject[key]]))
  }

  const readAsTypedFile = (filename) => {
    const type = pathToType(filename)
    if (lstatSync(filename).isSymbolicLink()) {
      return { symlink: readlinkSync(filename) }
    }
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
    readdirSync(folder, { withFileTypes: true, recursive: true }).map(dirent => {
      const childPath = join(dirent.parentPath, dirent.name)
      if (dirent.isDirectory()) {
        return false
      } else if (dirent.isSymbolicLink()) {
        const symlink = readlinkSync(childPath)
        updateModuleLink(undefined, symlink)
        return [childPath, { symlink }]
      }
      return [childPath, readAsTypedFile(childPath)]
    }).filter(Boolean)
  )
  const writeFileAsType = (filename, newContent, oldContent) => {
    const foldername = dirname(filename)
    if (foldername.length) mkdirSync(foldername, { recursive: true })
    const type = pathToType(filename)
    if (typeof newContent === 'string') {
      writeFileSync(filename, newContent)
    } else if (newContent?.symlink) {
      symlinkSync(newContent.symlink, filename)
      updateModuleLink(oldContent?.symlink, newContent.symlink)
      console.log(`\n\nsymlink created: ${filename} -> ${newContent.symlink}, replaced old symlink?: ${oldContent?.symlink ?? 'none'}\n\n`)
    } else if (type === JSON_FILE) {
      writeFileSync(filename, JSON.stringify(newContent, null, 2))
    } else if (type === TEXT_FILE) {
      writeFileSync(filename, newContent.join('\n'))
    } else if (type === BINARY_FILE) {
      writeFileSync(filename, Buffer.from(newContent))
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

  const setFsToValue = (newFilesObject, oldFilesObject, cwd) => {
    const filteredNewFilesObject = gitFilterFilesObject(newFilesObject)
    const filteredOldFilesObject = gitFilterFilesObject(oldFilesObject)
    for (const key in filteredOldFilesObject) {
      if (!(key in filteredNewFilesObject)) {
        deleteFile(join(cwd, key))
        delete oldFilesObject[key]
      }
    }
    for (const key in filteredNewFilesObject) {
      if (!deepEqual(filteredNewFilesObject[key], filteredOldFilesObject[key])) {
        writeFileAsType(join(cwd, key), filteredNewFilesObject[key], oldFilesObject[key])
        oldFilesObject[key] = filteredNewFilesObject[key]
      }
    }
  }

  const workspace = await turtleDB.makeWorkspace(signer, name)
  const rawFsFilesObject = readFolder(folder)
  let timeout
  const actionsByPath = new Map()
  const getPathHandlerFor = action => async path => {
    actionsByPath.set(relative(folder, path), action)
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      for (const [path, action] of actionsByPath) {
        logDebug(() => console.log(`(fileSync) ${action} in ("${name}"): ${path}`))
        const fsFile = rawFsFilesObject[path]
        if (action === UPDATED_FILE) {
          try {
            const typedFile = readAsTypedFile(join(folder, path))
            const oldSymlink = fsFile?.symlink
            const newSymlink = typedFile?.symlink
            console.log('getPathHandlerFor UPDATED_FILE')
            updateModuleLink(oldSymlink, newSymlink)
            rawFsFilesObject[path] = typedFile
          } catch (error) {
            logError(() => console.error(`Error reading file "${path}" so assuming deletion:`, error))
            delete rawFsFilesObject[path]
          }
        } else if (action === REMOVED_FILE) {
          console.log('getPathHandlerFor REMOVED_FILE')
          updateModuleLink(fsFile?.symlink, undefined)
          delete rawFsFilesObject[path]
        }
      }
      console.log('actionsByPath.keys', Array.from(actionsByPath.keys()))
      actionsByPath.clear()
      console.log('raw keys', Object.keys(rawFsFilesObject))
      const filteredFsFilesObject = gitFilterFilesObject(rawFsFilesObject)
      console.log('filteredFsFilesObject keys', Object.keys(filteredFsFilesObject))
      // debugger
      console.log({ folder, name })

      const documentValue = workspace.lookup('document', 'value') || {}
      const filteredDocumentValue = gitFilterFilesObject(documentValue)
      console.log('filteredDocumentValue keys', Object.keys(filteredDocumentValue))

      const changes = []
      for (const key in filteredFsFilesObject) {
        if (!deepEqual(documentValue[key], filteredFsFilesObject[key])) {
          changes.push({ key, change: 'updated' })
          documentValue[key] = filteredFsFilesObject[key]
        }
      }
      for (const key in filteredDocumentValue) {
        if (!(key in filteredFsFilesObject)) {
          changes.push({ key, change: 'deleted' })
          delete documentValue[key]
        }
      }
      if (changes.length > 0) {
        logInfo(() => console.log(`(fileSync) committing changes due to event(s) ${JSON.stringify(changes)} in "${name}"`))
        workspace.commit(filteredDocumentValue, `chokidar watch change(s) ${JSON.stringify(changes)} in "${name}"`)
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
    const filteredCommittedDocumentValue = gitFilterFilesObject(committedDocumentValue)
    if (!rawFsFilesObject['.gitignore'] && firstRun) {
      rawFsFilesObject['.gitignore'] = filteredCommittedDocumentValue?.['.gitignore'] || ['.turtleDB', '.env', '.DS_Store', '']
      writeFileAsType(join(folder, '.gitignore'), rawFsFilesObject['.gitignore'])
    }
    const filteredFsFilesObject = gitFilterFilesObject(rawFsFilesObject)
    if (workspace.committedBranch.index >= 0) {
      if (firstRun || resolve === THEIRS) {
        setFsToValue(committedDocumentValue, rawFsFilesObject, folder)
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
    */

  return workspace
}
