import { watch } from 'chokidar'
import { dirname, join, parse, relative } from 'path'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { getCodecs, KIND } from '../public/js/dataModel/CODECS.js'

export const ignored = /(?:\/node_modules\b|\/\..*|.*\.ico$|\.lock$|~$)/i

export async function watchfs (committer, recaller, root, prefix, allowDelete = false) {
  const lastRefs = {}

  const emptyPromise = new Promise(resolve => setTimeout(() => {
    if (commitInProgress === emptyPromise) setTimeout(resolve, 1000)
    else resolve(commitInProgress)
  }), 1000)
  let commitInProgress = emptyPromise

  const valueRefs = {}
  const debounceEdits = (message) => {
    const possibleNextCommit = new Promise(resolve => {
      setTimeout(() => {
        if (possibleNextCommit === commitInProgress) {
          committer.commitAddress(
            message,
            committer.workspace.upsert(valueRefs, getCodecs(KIND.REFS_OBJECT))
          ).then(commit => {
            resolve(commit)
          })
        } else {
          resolve(commitInProgress)
        }
      }, 1000)
    })
    commitInProgress = possibleNextCommit
    return valueRefs
  }
  console.log(' === fspeer.js watching', root)
  /** @type {Promise} */
  watch(root, { ignored }).on('all', (event, path) => {
    const relativePath = relative(root, path)
    const prefixedPath = join(prefix, relativePath)
    if (/^(add|change)$/.test(event)) {
      const parsedPath = parse(relativePath)
      let file = readFileSync(path, 'utf8')
      if (parsedPath.ext.toLowerCase() === '.json') {
        try {
          file = JSON.parse(file)
        } catch (error) {
          console.error(error)
          return
        }
      }
      const fileAddress = committer.workspace.upsert(file)
      const valueRefs = debounceEdits('fspeer watch all')
      const fsRefs = valueRefs.fs ? committer.workspace.lookup(valueRefs.fs, getCodecs(KIND.REFS_OBJECT)) : {}
      if (fsRefs[prefixedPath] === fileAddress) return
      console.log(` -- ${event}, ${relativePath}, ${lastRefs[prefixedPath]} => ${fileAddress}`)
      lastRefs[prefixedPath] = fileAddress
      fsRefs[prefixedPath] = fileAddress
      valueRefs.fs = committer.workspace.upsert(fsRefs, getCodecs(KIND.REFS_OBJECT))
    } else if (event === 'unlink') {
      const valueRefs = debounceEdits('fspeer watch all')
      if (!valueRefs || !valueRefs.fs) return
      const fsRefs = committer.workspace.lookup(valueRefs.fs, getCodecs(KIND.REFS_OBJECT))
      if (!fsRefs[prefixedPath]) return
      console.log(` -- ${event}, ${relativePath}, ${lastRefs[relativePath]} => X`)
      delete lastRefs[prefixedPath]
      delete fsRefs[prefixedPath]
      valueRefs.fs = committer.workspace.upsert(fsRefs, getCodecs(KIND.REFS_OBJECT))
    } else {
      console.log('unmatched chokidar.watch event', event)
    }
  })

  await commitInProgress

  console.log(committer.getRefs('value', 'fs'))

  console.log(' === and write to fs')

  recaller.watch('write to fs', () => {
    if (committer.length > 0) {
      const committerRefs = committer.getValue(getCodecs(KIND.REFS_OBJECT))
      const valueAddress = committerRefs?.value
      if (valueAddress) {
        const valueRefs = committer.lookup(valueAddress, getCodecs(KIND.REFS_OBJECT))
        const fsAddress = valueRefs?.fs
        if (fsAddress) {
          const fsRefs = committer.lookup(fsAddress, getCodecs(KIND.REFS_OBJECT)) || {}
          for (const relativePath in lastRefs) {
            if (fsRefs[relativePath] === undefined) {
              console.log(' +++ delete', relativePath)
              if (allowDelete) {
                rmSync(join(root, relativePath))
                delete lastRefs[relativePath]
              } else {
                throw new Error('no deleting during testing')
              }
            }
          }
          for (const relativePath in fsRefs) {
            const fileAddress = fsRefs[relativePath]
            if (fileAddress !== lastRefs[relativePath]) {
              const parsedPath = parse(relativePath)
              const relativeRelativePath = relative(prefix, relativePath)
              const fullpath = join(root, relativeRelativePath)
              mkdirSync(dirname(fullpath), { recursive: true })
              console.log(` +++ write to fs (address: ${fileAddress}) to [${relativePath}]`)
              lastRefs[relativePath] = fileAddress
              let file = committer.lookup(fileAddress)
              if (parsedPath.ext.toLowerCase() === '.json') {
                file = JSON.stringify(file, null, 2)
              }
              writeFileSync(fullpath, file)
            }
          }
        }
      }
    }
  })
}
