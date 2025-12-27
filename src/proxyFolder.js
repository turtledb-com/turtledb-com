import { mkdirSync, readdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync, readlinkSync, lstatSync, rmdirSync } from 'fs'
import { dirname, join, relative } from 'path'
import { logError } from '../public/js/utils/logger.js'
import { deepEqual } from '../public/js/utils/deepEqual.js'
import { Recaller } from '../public/js/utils/Recaller.js'
import { subscribe } from '@parcel/watcher'

export const isLinesOfTextExtension = path => path.match(/\.(html|css|js|svg|txt|gitignore|env|node_repl_history)$/)
export const isJSONExtension = path => path.match(/\.(json)$/)

export const encodeTextFile = object => {
  if (!object || typeof object !== 'object') throw new Error('encodeFile requires an object')
  if (Array.isArray(object) && object.every(value => typeof value === 'string')) return object.join('\n')
  return JSON.stringify(object, undefined, 2)
}

const decodeBufferAsFileObject = (buffer, path) => {
  if (!buffer?.isBuffer?.() && !(buffer instanceof Uint8Array)) return buffer
  const uint8Array = new Uint8Array(buffer)
  const isLinesOfText = isLinesOfTextExtension(path)
  const isJSON = isJSONExtension(path)
  if (!isLinesOfText && !isJSON) return uint8Array
  const decoder = new TextDecoder('utf-8')
  const str = decoder.decode(uint8Array)
  if (isLinesOfText) return str.split(/\r?\n/)
  try {
    return JSON.parse(str)
  } catch (err) {
    logError(() => console.error(err))
    return str
  }
}

export const equalFileObjects = (a, b, path) => {
  const decodedA = decodeBufferAsFileObject(a, path)
  const decodedB = decodeBufferAsFileObject(b, path)
  return deepEqual(decodedA, decodedB)
}

export const UPDATES_HANDLER = Symbol('UPDATES_HANDLER')

/**
 * @param {string} folder
 * @param {Recaller} recaller
 * @param {function(string, any, any):void)}
 * @returns {Proxy}
 */
export const proxyFolder = (folder, recaller = new Recaller(folder), updatesHandler) => {
  const cleanEmptyDir = path => {
    if (['', '.', '/'].includes(path)) return
    const childPath = join(folder, path)
    if (readdirSync(childPath).length) return
    rmdirSync(childPath)
    const parentDirname = dirname(path)
    cleanEmptyDir(parentDirname)
  }

  const target = {}

  const writeFileObject = (path, newFileObject) => {
    const oldFileObject = target[path]
    if (equalFileObjects(oldFileObject, newFileObject, path)) return true
    const childPath = join(folder, path)
    if (newFileObject) {
      const folderPath = dirname(childPath)
      if (folderPath) mkdirSync(folderPath, { recursive: true })
    }
    if (oldFileObject) unlinkSync(childPath)
    if (!newFileObject) {
      // no such thing, remove it
      delete target[path]
      cleanEmptyDir(dirname(path))
    } else {
      target[path] = newFileObject
      if (newFileObject.symlink) {
        symlinkSync(newFileObject.symlink, childPath)
      } else if (newFileObject instanceof Uint8Array) {
        writeFileSync(childPath, Buffer.from(newFileObject))
      } else if (typeof newFileObject === 'object') {
        writeFileSync(childPath, encodeTextFile(newFileObject), { encoding: 'utf8' })
      } else {
        throw new Error('encodeFile requires an object')
      }
    }
    return true
  }

  const readFileObject = path => {
    const childPath = join(folder, path)
    let stats
    try {
      stats = lstatSync(childPath)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    let changed = ''
    if (stats && (stats.isFile() || stats.isSymbolicLink())) {
      let value
      if (stats.isSymbolicLink()) {
        const symlink = readlinkSync(childPath)
        value = { symlink }
      } else {
        value = decodeBufferAsFileObject(readFileSync(childPath), childPath)
      }
      if (!equalFileObjects(value, target[path], path)) {
        target[path] = value
        changed = 'set'
      }
    } else {
      if (target[path]) {
        delete target[path]
        changed = 'delete'
      }
    }
    if (changed) {
      recaller.reportKeyMutation(target, path, changed, `proxyFolder(${folder})`)
      for (let parentDirname = dirname(path); !['', '.', '/'].includes(parentDirname); parentDirname = dirname(parentDirname)) {
        recaller.reportKeyMutation(target, parentDirname, changed, `proxyFolder(${folder})`)
      }
    }
    return target[path]
  }

  const readFileObjects = folder => {
    // don't use recursive option because it follows symlinks
    readdirSync(folder, { withFileTypes: true }).forEach(dirent => {
      if (!dirent.isDirectory()) {
        readFileObject(join(dirent.parentPath, dirent.name))
      } else {
        readFileObjects(join(folder, dirent.name))
      }
    })
  }

  readFileObjects(folder)

  const proxy = new Proxy(target, {
    get: (target, name) => {
      recaller.reportKeyAccess(target, name, 'get', `proxyFolder(${folder})`)
      if (name === UPDATES_HANDLER) {
        return updatesHandler
      } else if (target[name]) {
        return target[name]
      } else {
        const matchingEntries = Object.entries(target).filter(([key]) => (key.startsWith(name + '/') || key === name))
        if (!matchingEntries.length) return
        return Object.fromEntries(matchingEntries)
      }
    },
    set: (target, name, value) => {
      if (name === UPDATES_HANDLER) {
        updatesHandler = value
        return true
      }
      return writeFileObject(name, value)
    },
    deleteProperty: (target, name) => {
      recaller.reportKeyMutation(target, name, 'delete', `proxyFolder(${folder})`)
      for (let parentDirname = dirname(name); !['', '.', '/'].includes(parentDirname); parentDirname = dirname(parentDirname)) {
        recaller.reportKeyMutation(target, parentDirname, 'delete', `proxyFolder(${folder})`)
      }
      return writeFileObject(name)
    }
  })

  let timeout
  const modifiedFiles = new Set()
  const handleFileChange = filename => {
    clearTimeout(timeout)
    modifiedFiles.add(filename)
    timeout = setTimeout(() => {
      const changes = {}
      modifiedFiles.forEach(filename => {
        const oldValue = target[filename]
        const newValue = readFileObject(filename)
        if (!equalFileObjects(oldValue, newValue, filename)) {
          changes[filename] = { oldValue, newValue }
        }
      })
      updatesHandler?.(changes)
      modifiedFiles.clear()
    }, 500)
  }

  subscribe(folder, (err, events) => {
    if (err) throw err
    events.forEach(({ path }) => {
      const filename = relative(folder, path)
      handleFileChange(filename)
    })
  })

  return proxy
}
