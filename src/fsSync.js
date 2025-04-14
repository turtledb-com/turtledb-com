import { watch } from 'chokidar'
import { readFile, unlink, writeFile } from 'fs/promises'
import { join, relative } from 'path'
import { AS_REFS } from '../public/js/turtle/codecs/CodecType.js'

/** @typedef {import('../public/js/turtle/Workspace.js').Workspace} Workspace */

export const ignored = /(?:\/node_modules\b|\/\..*|.*\.ico$|\.lock$|~$)/i

const UPDATED_FILE = 'updated file'
const REMOVED_FILE = 'removed file'
const UPDATED_VALUE = 'updated value'
const REMOVED_VALUE = 'removed value'

/**
 * @param {Workspace} workspace
 * @param {string} [root=workspace.name]
 * @param {string} [jspath='fs']
 */
export function fsSync (workspace, root = workspace.name, jspath = 'fs') {
  let greenLightPromise
  const greenLight = async () => {
    const previousPromise = greenLightPromise
    let resolve
    greenLightPromise = new Promise((...args) => { [resolve] = args })
    await previousPromise
    return resolve
  }
  const nextActionByPath = {}
  const jsobj = workspace.committedBranch.lookup('document', 'value', jspath, AS_REFS) ?? {}
  let commitDebounce
  const getPathHandlerFor = action => async path => {
    const relativePath = relative(root, path)
    // console.log(workspace.name, action, relativePath)
    const alreadyRunning = Object.hasOwn(nextActionByPath, relativePath)
    nextActionByPath[relativePath] = action
    if (alreadyRunning) return
    const endGreenLight = await greenLight()
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
        if (!newAddress) {
          console.error(workspace.committedBranch.lookup('document', 'value', jspath, AS_REFS))
          throw new Error(`no address found at ${relativePath}`)
        }
        jsobj[relativePath] = newAddress
        const file = workspace.committedBranch.lookup('document', 'value', jspath, relativePath)
        if (!file) {
          console.error(workspace.committedBranch.lookup('document', 'value', jspath, AS_REFS))
          throw new Error(`no file found at relativePath: ${relativePath}, address: ${newAddress}`)
        }
      } else if (action === REMOVED_VALUE) {
        delete jsobj[relativePath]
        await unlink(path)
      }
    }
    delete nextActionByPath[relativePath]
    if (!Object.keys(nextActionByPath).length) {
      clearTimeout(commitDebounce)
      commitDebounce = setTimeout(async () => {
        const valueAsRefs = workspace.lookup('document', 'value', AS_REFS) || {}
        valueAsRefs[jspath] = workspace.upsert(jsobj, undefined, AS_REFS)
        const valueAddress = workspace.upsert(valueAsRefs, undefined, AS_REFS)
        console.log('fs commit from local changes debounce', jsobj)
        await workspace.commit(valueAddress, 'chokidar.watch', true)
        endGreenLight()
      }, 500) // delay should take longer than the commit
    }
  }
  watch(root, { ignored })
    .on('add', getPathHandlerFor(UPDATED_FILE))
    .on('change', getPathHandlerFor(UPDATED_FILE))
    .on('unlink', getPathHandlerFor(REMOVED_FILE))
  workspace.committedBranch.recaller.watch(`fsSync"${root}"`, async () => {
    workspace.committedBranch.lookup() // trigger recaller
    const endGreenLight = await greenLight()
    const newJsobj = workspace.committedBranch.lookup('document', 'value', jspath, AS_REFS)
    if (!newJsobj) return endGreenLight()
    const promises = []
    for (const path in jsobj) {
      if (!newJsobj[path]) {
        promises.push(unlink(join(root, path)))
      }
    }
    for (const path in newJsobj) {
      if (newJsobj[path] !== jsobj[path]) {
        const relativePath = join(root, path)
        const newAddress = workspace.committedBranch.lookup('document', 'value', jspath, AS_REFS)?.[relativePath]
        if (!newAddress) {
          console.error(workspace.committedBranch.lookup('document', 'value', jspath, AS_REFS))
          throw new Error(`no address found at ${relativePath}`)
        }
        const file = workspace.committedBranch.lookup('document', 'value', jspath, relativePath)
        if (!file) {
          console.error(workspace.committedBranch.lookup('document', 'value', jspath, AS_REFS))
          throw new Error(`no file found at relativePath: ${relativePath}, address: ${newAddress}`)
        }
        promises.push(writeFile(relativePath, file))
      }
    }
    if (promises.length) console.log('fs update from workspace.committedBranch', workspace.lookup('document', 'value', jspath, AS_REFS), promises.length)
    await Promise.all(promises)
    endGreenLight()
  })
}
