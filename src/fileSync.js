import { join } from 'path'
import { compile } from '@gerhobbelt/gitignore-parser'
import { linesToString } from '../public/js/utils/fileTransformer.js'
import { logInfo } from '../public/js/utils/logger.js'
import { THROW } from '../public/js/turtle/TurtleDictionary.js'
import { equalFileObjects, proxyFolder, UPDATES_HANDLER } from './proxyFolder.js'

/**
 * @typedef {import('../public/js/turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
 * @typedef {import('../public/js/turtle/Signer.js').Signer} Signer
 * @typedef {import('../public/js/turtle/Workspace.js').Workspace} Workspace
 */

const gitFilteredFilenames = (filesObject = {}, turtleDBFolder, gitignoreContent) => {
  gitignoreContent = linesToString(gitignoreContent || filesObject['.gitignore'] || ['.env', '.DS_Store'])
  const gitignore = compile(gitignoreContent)
  const filteredKeys = Object.keys(filesObject).filter(filename => {
    return gitignore.accepts(filename) && !filename.startsWith(turtleDBFolder + '/')
  })
  // console.log(filteredKeys, turtleDBFolder)
  return filteredKeys.sort()
}

const replicateFiles = (a, b, turtleDBFolder, applyGitFilter) => {
  const aFilenames = applyGitFilter ? gitFilteredFilenames(a, turtleDBFolder) : Object.keys(a)
  let bFilenames = applyGitFilter ? gitFilteredFilenames(b, turtleDBFolder) : Object.keys(b)
  let touched = false
  aFilenames.forEach(key => {
    if (!equalFileObjects(b[key], a[key], key)) {
      // console.log(b[key], a[key])
      console.log(`setting b[${key}], replace:${!!b[key]}`)
      b[key] = a[key]
      touched = true
    }
  })
  bFilenames = applyGitFilter ? gitFilteredFilenames(b, turtleDBFolder) : Object.keys(b) // after possible .gitignore update
  bFilenames.forEach(key => {
    if (!aFilenames.includes(key)) {
      console.log(`deleting b[${key}]`)
      delete b[key]
      touched = true
    }
  })
  return touched
}

const syncModule = (turtleBranch, moduleFolder, folderFilesObject, turtleDBFolder) => {
  // return
  const setModuleFiles = moduleFilesObject => {
    const folderFilesObjectCopy = {}
    Object.keys(folderFilesObject)
      .filter(filename => !filename.startsWith(moduleFolder))
      .forEach(filename => {
        folderFilesObjectCopy[filename] = folderFilesObject[filename]
      })
    Object.keys(moduleFilesObject).forEach(filename => {
      folderFilesObjectCopy[join(moduleFolder, filename)] = moduleFilesObject[filename]
    })
    replicateFiles(folderFilesObjectCopy, folderFilesObject, turtleDBFolder, false)
  }
  const turtleWatcher = async () => {
    const moduleFilesObject = turtleBranch.lookup('document', 'value')
    if (!moduleFilesObject || typeof moduleFilesObject !== 'object') throw new Error(`value described in synced folder ${moduleFolder} is not a module object`)
    setModuleFiles(moduleFilesObject)
  }
  turtleBranch.recaller.watch(`fileSync"${turtleBranch.name}"`, turtleWatcher)
  return () => {
    turtleBranch.recaller.unwatch(turtleWatcher)
  }
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
  const workspaceFilesObject = workspace.lookup('document', 'value') || {}
  const folderFilesObject = proxyFolder(folder, turtleDB.recaller)

  // initialize between folder and workspace
  if (gitFilteredFilenames(folderFilesObject).length) {
    if (Object.keys(workspaceFilesObject).length) {
      // clobber for now
      logInfo(() => console.log('clobber filesystem files for now'))
      replicateFiles(workspaceFilesObject, folderFilesObject, turtleDBFolder, true)
    } else {
      logInfo(() => console.log('empty workspace, replicating files to workspace'))
      replicateFiles(folderFilesObject, workspaceFilesObject, turtleDBFolder, true)
      await workspace.commit(workspaceFilesObject, 'initial commit of local tracked files')
    }
  } else {
    if (Object.keys(workspaceFilesObject).length) {
      replicateFiles(workspaceFilesObject, folderFilesObject, turtleDBFolder, true)
    } else {
      throw new Error('TODO: handle first time user')
    }
  }

  const syncModulesBySymlink = {}
  const addSymlink = symlink => {
    if (!syncModulesBySymlink[symlink]) {
      let unsync = async () => {
        unsync = null
      }
      (async () => {
        const publicKey = symlink.match(/\/([0-9a-z]{40,50})$/)?.[1]
        const turtleBranch = await turtleDB.summonBoundTurtleBranch(publicKey)
        unsync &&= await syncModule(turtleBranch, symlink, folderFilesObject, turtleDBFolder) // &&= in case it got cancelled before the summon completed
      })()
      syncModulesBySymlink[symlink] = { count: 0, unsync }
    }
    ++syncModulesBySymlink[symlink].count
  }
  const removeSymlink = symlink => {
    if (!syncModulesBySymlink[symlink]) throw new Error(`unexpected old symlink "${symlink}" not being tracked`)
    const { count, unsync } = syncModulesBySymlink[symlink] || {}
    if (count > 0) {
      --syncModulesBySymlink[symlink].count
    } else {
      unsync?.()
      delete syncModulesBySymlink[symlink]
    }
  }
  const folderUpdatesHandler = async (changes) => {
    const changesFilenames = gitFilteredFilenames(changes, turtleDBFolder, folderFilesObject['.gitignore'])
    if (!changesFilenames.length) return
    changesFilenames.forEach((filename) => {
      const { oldValue, newValue } = changes[filename]
      if (!equalFileObjects(oldValue, workspaceFilesObject[filename], filename)) throw new Error(`old file value mismatch "${filename}" (TODO: handle collision case)`) // TODO: handle collision case
      workspaceFilesObject[filename] = newValue
      const oldSymlink = oldValue?.symlink
      const newSymlink = newValue?.symlink
      if (oldSymlink === newSymlink) return
      if (oldSymlink) removeSymlink(oldSymlink)
      if (newSymlink) addSymlink(newSymlink)
    })
    await workspace.commit(workspaceFilesObject, 'changes from filesystem')
  }

  // setup symlinks
  gitFilteredFilenames(folderFilesObject).forEach(filename => {
    const symlink = folderFilesObject[filename].symlink
    if (symlink) addSymlink(symlink)
  })

  folderFilesObject[UPDATES_HANDLER] = folderUpdatesHandler

  return workspace
}
