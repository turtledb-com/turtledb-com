import { watch } from 'chokidar'
import { readFile, unlink, writeFile } from 'fs/promises'
import { join, relative } from 'path'
import { AS_REFS } from '../public/js/turtle/codecs/CodecType.js'

/** @typedef {import('../public/js/turtle/Workspace.js').Workspace} Workspace */

export const ignored = /(?:\/node_modules\b|\/\..*|.*\.ico$|\.lock$|~$)/i

const UPDATED_FILE = 'updated file'
const REMOVED_FILE = 'removed file'

/**
 * @param {Workspace} workspace
 * @param {string} [root=workspace.name]
 * @param {string} [jspath='fs']
 */
export function fsSync (workspace, root = workspace.name, jspath = 'fs') {
  let skipCommit = false
  let nextTurnPromise
  const nextTurn = async () => {
    const previousPromise = nextTurnPromise
    let endTurn
    nextTurnPromise = new Promise((...args) => { [endTurn] = args })
    await previousPromise
    return endTurn
  }
  const nextActionByPath = {}
  let jsobj = workspace.committedBranch.lookup('document', 'value', jspath) ?? {}
  let commitDebounce
  const getPathHandlerFor = action => async path => {
    const relativePath = relative(root, path)
    // console.log(workspace.name, action, relativePath)
    const alreadyRunning = Object.hasOwn(nextActionByPath, relativePath)
    nextActionByPath[relativePath] = action
    if (alreadyRunning) return
    const endTurn = await nextTurn()
    while (nextActionByPath[relativePath]) {
      action = nextActionByPath[relativePath]
      nextActionByPath[relativePath] = null
      if (action === UPDATED_FILE) {
        jsobj[relativePath] = await readFile(path, 'utf8')
      } else if (action === REMOVED_FILE) {
        delete jsobj[relativePath]
      }
    }
    delete nextActionByPath[relativePath]
    if (!Object.keys(nextActionByPath).length) {
      clearTimeout(commitDebounce)
      commitDebounce = setTimeout(async () => {
        if (!skipCommit) {
          const valueAsRefs = workspace.lookup('document', 'value', AS_REFS) || {}
          const previousAddress = valueAsRefs[jspath]
          valueAsRefs[jspath] = workspace.upsert(jsobj)
          if (valueAsRefs[jspath] !== previousAddress) {
            const valueAddress = workspace.upsert(valueAsRefs, undefined, AS_REFS)
            console.log('fs commit from local changes commit', valueAddress)
            await workspace.commit(valueAddress, 'chokidar.watch', true)
          }
        }
        endTurn()
      }, 500) // delay should take longer than the commit
    } else {
      endTurn()
    }
  }
  watch(root, { ignored })
    .on('add', getPathHandlerFor(UPDATED_FILE))
    .on('change', getPathHandlerFor(UPDATED_FILE))
    .on('unlink', getPathHandlerFor(REMOVED_FILE))
  workspace.committedBranch.recaller.watch(`fsSync"${root}"`, async () => {
    skipCommit = true
    workspace.committedBranch.lookup() // trigger recaller
    const endTurn = await nextTurn()
    const newJsobj = workspace.committedBranch.lookup('document', 'value', jspath)
    if (newJsobj) {
      const changes = []
      for (const relativePath in jsobj) {
        const path = join(root, relativePath)
        if (newJsobj[relativePath] === undefined) {
          changes.push(unlink(path))
        }
      }
      for (const relativePath in newJsobj) {
        const path = join(root, relativePath)
        if (newJsobj[relativePath] !== jsobj[relativePath]) {
          changes.push(writeFile(path, newJsobj[relativePath]))
        }
      }
      if (changes.length) console.log('fs update from workspace.committedBranch, changes.length', changes.length)
      await Promise.all(changes)
      jsobj = newJsobj
    }
    skipCommit = false
    endTurn()
  })
}
