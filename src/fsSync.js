import { watch } from 'chokidar'
import { readFile, unlink, writeFile } from 'fs/promises'
import { join, relative } from 'path'
import { AS_REFS } from '../public/js/turtle/codecs/CodecType.js'

/** @typedef {import('../public/js/turtle/Workspace.js').Workspace} Workspace */

export const ignored = /(?:\/node_modules\b|\/\..*|.*\.ico$|\.lock$|~$)/i

const UPDATED_FILE = 'updated file'
const REMOVED_FILE = 'removed file'
const UPDATED_VALUE = 'updated value'

/**
 * @param {Workspace} workspace
 * @param {string} [root=workspace.name]
 * @param {string} [jspath='']
 */
export function fsSync (workspace, root = workspace.name, jspath = 'fs') {
  const nextActionByPath = {}
  const jsobj = workspace.lastCommitValue?.[jspath] ?? {}
  let commitDebounce
  const getPathHandlerFor = action => async path => {
    const relativePath = relative(root, path)
    // console.log(workspace.name, action, relativePath)
    const alreadyRunning = Object.hasOwn(nextActionByPath, relativePath)
    nextActionByPath[relativePath] = action
    if (alreadyRunning) return
    while (nextActionByPath[relativePath]) {
      action = nextActionByPath[relativePath]
      nextActionByPath[relativePath] = null
      if (action === UPDATED_FILE) {
        const file = await readFile(path, 'utf8')
        jsobj[relativePath] = workspace.upsert(file)
      } else if (action === REMOVED_FILE) {
        delete jsobj[relativePath]
      } else if (action === UPDATED_VALUE) {
        const newAddress = workspace.committedBranch.lookup('document', 'value', jspath, AS_REFS)?.[relativePath]
        if (newAddress !== jsobj[relativePath]) {
          if (!newAddress) {
            await unlink(path)
            delete jsobj[relativePath]
          } else {
            const file = workspace.committedBranch.lookup('document', 'value', jspath, relativePath)
            await writeFile(path, file, 'utf8')
            jsobj[relativePath] = newAddress
          }
        }
      }
    }
    delete nextActionByPath[relativePath]
    if (!Object.keys(nextActionByPath).length) {
      clearTimeout(commitDebounce)
      commitDebounce = setTimeout(async () => {
        const valueAsRefs = workspace.lookup('document', 'value', AS_REFS) || {}
        valueAsRefs[jspath] = workspace.upsert(jsobj, undefined, AS_REFS)
        const valueAddress = workspace.upsert(valueAsRefs, undefined, AS_REFS)
        console.log('fs commit from local changes debounce')
        await workspace.commit(valueAddress, 'chokidar.watch', true)
      }, 500) // delay should take longer than the commit
    }
  }
  watch(root, { ignored })
    .on('add', getPathHandlerFor(UPDATED_FILE))
    .on('change', getPathHandlerFor(UPDATED_FILE))
    .on('unlink', getPathHandlerFor(REMOVED_FILE))
  workspace.committedBranch.recaller.watch(`fsSync"${root}"`, () => {
    const paths = workspace.committedBranch.lookup('document', 'value', jspath, AS_REFS)
    if (!paths) return
    console.log('fs update from workspace.committedBranch')
    for (const path in jsobj) {
      if (!paths[path]) {
        const handleRemovedValue = getPathHandlerFor(UPDATED_VALUE)
        handleRemovedValue(join(root, path))
      }
    }
    for (const path in paths) {
      if (paths[path] !== jsobj[path]) {
        const handleUpdatedValue = getPathHandlerFor(UPDATED_VALUE)
        handleUpdatedValue(join(root, path))
      }
    }
  })
}
