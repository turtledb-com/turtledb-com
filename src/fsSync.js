import { watch } from 'chokidar'
import { readFile } from 'fs/promises'
import { dirname, join, parse, relative } from 'path'

/** @typedef {import('../public/js/turtle/Workspace.js').Workspace} Workspace */

export const ignored = /(?:\/node_modules\b|\/\..*|.*\.ico$|\.lock$|~$)/i

const UPDATED_FILE = 'updated file'
const REMOVED_FILE = 'removed file'

/**
 * @param {Workspace} workspace
 * @param {string} [root=workspace.name]
 * @param {string} [jspath='']
 */
export function fsSync (workspace, root = workspace.name, jspath = '') {
  const nextActionByPath = {}
  const jsobj = workspace.lastCommitValue ?? {}
  const getPathHandlerFor = action => async path => {
    const relativePath = relative(root, path)
    console.log(workspace.name, action, relativePath)
    const alreadyRunning = Object.hasOwn(nextActionByPath, relativePath)
    nextActionByPath[relativePath] = action
    if (alreadyRunning) return
    while (nextActionByPath[relativePath]) {
      action = nextActionByPath[relativePath]
      nextActionByPath[relativePath] = null
      if (action === UPDATED_FILE) {
        const file = await readFile(path, 'utf8')
        jsobj[relativePath] = file
      } else if (action === REMOVED_FILE) {
        delete jsobj[relativePath]
      }
    }
    delete nextActionByPath[relativePathj
    if (!Object.keys(nextActionByPath).length) {
      console.log('done')
      await workspace.commit(jsobj, 'chokidar.watch')
    }
    // if (event.match(/add|change/)) update(relativePath)
    // else if (event.match(/unlink/)) remove(relativePath)
  }
  watch(root, { ignored })
    .on('add', getPathHandlerFor(UPDATED_FILE))
    .on('change', getPathHandlerFor(UPDATED_FILE))
    .on('unlink', getPathHandlerFor(REMOVED_FILE))
}

/*
  const handleAddChangeUnlink = async (event, path) => {
    const relativePath = relative(root, path)
    console.log(workspace.name, event, relativePath)
    // if (event.match(/add|change/)) update(relativePath)
    // else if (event.match(/unlink/)) remove(relativePath)
  }
  watch(root, { ignored })
    .on('add', handleAddChangeUnlink)
    .on('change', handleAddChangeUnlink)
    .on('unlink', handleAddChangeUnlink)
}
    */
