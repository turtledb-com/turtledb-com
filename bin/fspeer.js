#!/usr/bin/env node

import { connect } from 'net'
import { dirname, join, parse, relative } from 'path'
import { watch } from 'chokidar'
import { program } from 'commander'
import { question } from 'readline-sync'
import { setPointerByPublicKey } from '../public/js/net/Peer.js'
import { Recaller } from '../public/js/utils/Recaller.js'
import { Committer } from '../public/js/dataModel/Committer.js'
import { newPeerPerCycle } from '../public/js/utils/peerFactory.js'
import { hashNameAndPassword } from '../public/js/utils/crypto.js'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { KIND, getCodecs } from '../public/js/dataModel/CODECS.js'
import { getCommitAddress } from '../public/js/dataModel/Uint8ArrayLayerPointer.js'

const ignored = /(?:\.ds_store|.*\.ico|~)$/i

program
  .name('fspeer')
  .option('--path <string>')
  .option('--s3port <number>', 'port for s3 proxy', x => +x, 1024)
  .option('--s3host <string>', 'host for s3 proxy', 'turtledb.com')
  .option('--name <string>', 'username')
  .option('--pass <string>', 'password')
  .option('--turtlename <string>', 'identifier')
  .parse()

let { path, s3port, s3host, name, pass, turtlename } = program.opts()
if (!name) name = question('username: ')
if (!pass) pass = question('password: ', { hideEchoBack: true })
if (!turtlename) turtlename = question('turtlename [home]: ') || 'home'

const recaller = new Recaller('fspeer')

const hashword = await hashNameAndPassword(name, pass)
const privateKey = await hashNameAndPassword(turtlename, hashword)
const committer = new Committer(turtlename, privateKey, recaller)
const compactPublicKey = committer.compactPublicKey

setPointerByPublicKey(compactPublicKey, recaller, committer)

const connectionCycle = (receive, setSend, peer) => new Promise((resolve, reject) => {
  global.peer = peer
  const socket = connect(s3port, s3host, () => {
    console.log('connected')
    setSend(uint8Array => socket.write(uint8Array))
  })
  console.log('connecting', s3port, s3host)
  socket.on('data', data => {
    receive(new Uint8Array(data.buffer))
  })
  socket.on('error', reject)
  socket.on('end', resolve)
})
newPeerPerCycle('[fspeer to s3peer]', recaller, connectionCycle)

let resolveTurtleCheck
const turtleLoaded = new Promise(resolve => { resolveTurtleCheck = resolve })
let startedLoading = false
const checkTurtle = () => {
  if (startedLoading) return
  console.log('check turtle')
  const loadedLayers = committer.layerIndex
  const availableLength = global.peer?.remoteExports?.lookup?.()?.[compactPublicKey]?.want?.[0]?.[0]
  console.log('our length:', loadedLayers + 1, 'their length:', availableLength)
  if (availableLength !== undefined && loadedLayers === availableLength - 1) {
    startedLoading = true
    console.log('stop watching')
    const valueRefs = committer.workspace.lookupRefs(getCommitAddress(committer), 'value') || {}
    const fsRefs = valueRefs.fs && committer.workspace.lookup(valueRefs.fs, getCodecs(KIND.REFS_OBJECT))
    const removed = []
    const filteredRefs = Object.fromEntries(
      Object.entries(fsRefs || {})
        .filter(([relativePath]) => {
          const ignore = relativePath.match(ignored)
          if (ignore) removed.push(relativePath)
          return !ignore
        })
    )
    if (removed.length) {
      console.log('removed files', removed)
      valueRefs.fs = committer.workspace.upsert(filteredRefs, getCodecs(KIND.REFS_OBJECT))
      const valueAddress = committer.workspace.upsert(valueRefs, getCodecs(KIND.REFS_OBJECT))
      committer.commitAddress('remove bad filenames', valueAddress)
        .then(resolveTurtleCheck)
    } else {
      resolveTurtleCheck()
    }
  }
}
recaller.watch('turtle loading check', checkTurtle)
await turtleLoaded
recaller.unwatch(checkTurtle)

const lastRefs = {}

const root = join(process.cwd(), path)
mkdirSync(dirname(root), { recursive: true })

/** @type {Promise} */
let commitInProgress
watch(root, { ignored }).on('all', (event, path) => {
  const relativePath = relative(root, path)
  // console.log(event, relativePath)
  const prev = commitInProgress
  commitInProgress = (async () => {
    await prev
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
      const valueRefs = committer.workspace.lookupRefs(getCommitAddress(committer), 'value') ?? {}
      const fsRefs = valueRefs.fs ? committer.workspace.lookup(valueRefs.fs, getCodecs(KIND.REFS_OBJECT)) : {}
      if (fsRefs[relativePath] === fileAddress) return
      console.log(` -- ${event}, ${relativePath}, ${lastRefs[relativePath]} => ${fileAddress}`)
      lastRefs[relativePath] = fileAddress
      fsRefs[relativePath] = fileAddress
      valueRefs.fs = committer.workspace.upsert(fsRefs, getCodecs(KIND.REFS_OBJECT))
      await committer.commitAddress('fspeer watch all', committer.workspace.upsert(valueRefs, getCodecs(KIND.REFS_OBJECT)))
    } else if (event === 'unlink') {
      const valueRefs = committer.workspace.lookupRefs(getCommitAddress(committer), 'value')
      if (!valueRefs || !valueRefs.fs) return
      const fsRefs = committer.workspace.lookup(valueRefs.fs, getCodecs(KIND.REFS_OBJECT))
      if (!fsRefs[relativePath]) return
      console.log(` -- ${event}, ${relativePath}, ${lastRefs[relativePath]} => X`)
      delete lastRefs[relativePath]
      delete fsRefs[relativePath]
      valueRefs.fs = committer.workspace.upsert(fsRefs, getCodecs(KIND.REFS_OBJECT))
      await committer.commitAddress('fspeer watch all', committer.workspace.upsert(valueRefs, getCodecs(KIND.REFS_OBJECT)))
    } else {
      console.log('unhandled chokidar.watch event', event)
    }
  })()
})

let prev
do {
  prev = commitInProgress
  await commitInProgress
  await new Promise(resolve => setTimeout(resolve, 1000))
} while (prev !== commitInProgress)

console.log(' === and write to fs')

recaller.watch('write to fs', () => {
  const commitAddress = getCommitAddress(committer)
  if (commitAddress > 0) {
    const committerRefs = committer.lookup(commitAddress, getCodecs(KIND.REFS_OBJECT))
    const valueAddress = committerRefs?.value
    if (valueAddress) {
      const valueRefs = committer.lookup(valueAddress, getCodecs(KIND.REFS_OBJECT))
      const fsAddress = valueRefs?.fs
      if (fsAddress) {
        const fsRefs = committer.lookup(fsAddress, getCodecs(KIND.REFS_OBJECT)) || {}
        for (const relativePath in lastRefs) {
          if (fsRefs[relativePath] === undefined) {
            console.log(' +++ delete', relativePath)
            rmSync(join(root, relativePath))
            delete lastRefs[relativePath]
          }
        }
        for (const relativePath in fsRefs) {
          const fileAddress = fsRefs[relativePath]
          if (fileAddress !== lastRefs[relativePath]) {
            const parsedPath = parse(relativePath)
            const fullpath = join(root, relativePath)
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
