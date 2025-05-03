import { watch } from 'chokidar'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { dirname, join, relative } from 'path'
import { AS_REFS } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/codecs/CodecType.js'
import { existsSync, mkdirSync } from 'fs'

/**
 * @typedef {import('../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
 * @typedef {import('../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Signer.js').Signer} Signer
 * @typedef {import('../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/Workspace.js').Workspace} Workspace
 */

export const ignored = /(?:\/node_modules\b|\/\..*|.*\.ico$|\.lock$|~$)/i

const UPDATED_FILE = 'updated file'
const REMOVED_FILE = 'removed file'

/**
 * @param {string} name
 * @param {TurtleDB} turtleDB
 * @param {Signer} signer
 * @param {string} [jspath='fs']
 */
export async function fsSync (name, turtleDB, signer, jspath = 'fs') {
  const workspace = await turtleDB.makeWorkspace(signer, name)
  const { publicKey: root } = await signer.makeKeysFor(name)
  if (!existsSync(root)) mkdirSync(root)
  let skipCommit = false
  let nextTurnPromise
  const nextTurn = async () => {
    const previousPromise = nextTurnPromise
    let endTurn
    nextTurnPromise = new Promise((...args) => { [endTurn] = args })
    await previousPromise
    return endTurn
  }
  let jsobj = {}

  const nextActionsByPath = {}
  let isHandlingChokidar
  const getPathHandlerFor = action => async path => {
    const isFirst = !Object.keys(nextActionsByPath).length && !isHandlingChokidar
    isHandlingChokidar = true
    const relativePath = relative(root, path)
    console.log(workspace.name, action, relativePath)
    nextActionsByPath[relativePath] ??= []
    const nextActions = nextActionsByPath[relativePath]
    nextActions.push(action)
    if (!isFirst) return
    await new Promise(resolve => setTimeout(resolve, 100)) // let chokidar cook
    const endTurn = await nextTurn()
    // console.log('next actions', nextActionsByPath)
    while (Object.keys(nextActionsByPath).length) {
      const readFilePromises = []
      for (const relativePath in nextActionsByPath) {
        const path = join(root, relativePath)
        const action = nextActionsByPath[relativePath].pop()
        delete nextActionsByPath[relativePath]
        if (action === UPDATED_FILE) {
          readFilePromises.push(readFile(path, 'utf8').then(file => { jsobj[relativePath] = file }))
        } else if (action === REMOVED_FILE) {
          delete jsobj[relativePath]
        }
      }
      await Promise.all(readFilePromises)
    }
    isHandlingChokidar = false

    setTimeout(async () => {
      if (!skipCommit) {
        const valueAsRefs = workspace.lookup('document', 'value', AS_REFS) || {}
        const previousAddress = valueAsRefs[jspath]
        // console.log('before upsert', Object.keys(jsobj).filter(key => key.match(/old/)))
        valueAsRefs[jspath] = workspace.upsert(jsobj)
        if (valueAsRefs[jspath] !== previousAddress) {
          const valueAddress = workspace.upsert(valueAsRefs, undefined, AS_REFS)
          console.log('fs commit from local changes commit', valueAddress)
          await workspace.commit(valueAddress, 'chokidar.watch', true)
        }
      }
      endTurn()
    }, 500) // delay should take longer than the commit
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
          console.log('removing from committedBranch changes', relativePath)
          changes.push(unlink(path))
        }
      }
      for (const relativePath in newJsobj) {
        const path = join(root, relativePath)
        if (newJsobj[relativePath] !== jsobj[relativePath]) {
          console.log('adding from committedBranch changes', relativePath)
          changes.push(mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, newJsobj[relativePath])))
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
