import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync, readlinkSync, lstatSync, read, existsSync, rmdirSync } from 'fs'
import { dirname, join } from 'path'
import { BINARY_FILE, JSON_FILE, pathToType, TEXT_FILE } from '../public/js/utils/fileTransformer.js'
import { logError } from '../public/js/utils/logger.js'
import { deepEqual } from '../public/js/utils/deepEqual.js'
import { Recaller } from '../public/js/utils/Recaller.js'
import { watch } from 'chokidar'

export const isLinesOfTextExtension = path => path.match(/\.(html|css|js|svg|txt|gitignore)$/)
export const isJSONExtension = path => path.match(/\.(json)$/)

export const encodeTextFile = object => {
  if (!object || typeof object !== 'object') throw new Error('encodeFile requires an object')
  if (Array.isArray(object) && object.every(value => typeof value === 'string')) return object.join('\n')
  return JSON.stringify(object, undefined, 2)
}

/**
 * @param {string} folder
 * @param {Recaller} recaller
 * @param {function(string, any, any):void)}
 * @returns {Proxy}
 */
export const proxyFolder = (folder, recaller = new Recaller(folder), update) => {
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
    const childPath = join(folder, path)
    if (newFileObject) {
      const folderPath = dirname(childPath)
      if (folderPath) mkdirSync(folderPath, { recursive: true })
    }
    const oldFileObject = target[path]
    if (deepEqual(oldFileObject, newFileObject)) return true
    update?.(path, oldFileObject, newFileObject)
    if (oldFileObject) unlinkSync(childPath)
    if (!newFileObject) {
      // no such thing, remove it
      delete target[path]
      cleanEmptyDir(dirname(path))
    } else {
      target[path] = newFileObject
      if (newFileObject.symlink) {
        symlinkSync(childPath, newFileObject.symlink)
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
    const exists = existsSync(childPath)
    let changed = ''
    if (exists) {
      let value
      if (lstatSync(childPath).isSymbolicLink()) {
        const symlink = readlinkSync(childPath)
        value = { symlink }
      } else if (isLinesOfTextExtension(path)) {
        value = readFileSync(path, { encoding: 'utf8' }).split(/\r?\n/)
      } else if (isJSONExtension(path)) {
        const unparsedJson = readFileSync(path, { encoding: 'utf8' })
        try {
          value = JSON.parse(unparsedJson)
        } catch (err) {
          value = unparsedJson
          console.error(err)
        }
      } else {
        value = new Uint8Array(readFileSync(childPath))
      }
      if (!deepEqual(value, target[path])) {
        update?.(path, target[path], value)
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

  readdirSync(folder, { withFileTypes: true, recursive: true }).forEach(dirent => {
    if (!dirent.isDirectory()) {
      readFileObject(join(dirent.parentPath, dirent.name))
    }
  })

  const proxy = new Proxy(target, {
    get: (target, name) => {
      recaller.reportKeyAccess(target, name, 'get', `proxyFolder(${folder})`)
      console.log('getting', name)
      if (target[name]) {
        return target[name]
      } else {
        const matchingEntries = Object.entries(target).filter(([key]) => (key.startsWith(name + '/') || key === name))
        if (!matchingEntries.length) return
        return Object.fromEntries(matchingEntries)
      }
    },
    set: (target, name, value) => {
      writeFileObject(name, value)
    },
    deleteProperty: (target, name) => {
      recaller.reportKeyMutation(target, name, 'delete', `proxyFolder(${folder})`)
      for (let parentDirname = dirname(name); !['', '.', '/'].includes(parentDirname); parentDirname = dirname(parentDirname)) {
        recaller.reportKeyMutation(target, parentDirname, 'delete', `proxyFolder(${folder})`)
      }
      writeFileObject(name)
    }
  })

  let timeout
  const modifiedFiles = new Set()
  const handleFileChange = filename => {
    clearTimeout(timeout)
    modifiedFiles.add(filename)
    timeout = setTimeout(() => {
      console.log(modifiedFiles)
      modifiedFiles.forEach(readFileObject)
      modifiedFiles.clear()
    }, 500)
  }
  watch(folder, {
    followSymlinks: false,
    ignoreInitial: true
  })
    .on('add', handleFileChange)
    .on('change', handleFileChange)
    .on('unlink', handleFileChange)

  console.log(target)
  // debugger

  return proxy
}
