#!/usr/bin/env node

import { connect } from 'net'
import { dirname, join } from 'path'
import { program } from 'commander'
import { question } from 'readline-sync'
import { getPointerByPublicKey } from '../public/js/net/Peer.js'
import { Recaller } from '../public/js/utils/Recaller.js'
import { Committer } from '../public/js/dataModel/Committer.js'
import { newPeerPerCycle } from '../public/js/utils/peerFactory.js'
import { hashNameAndPassword } from '../public/js/utils/crypto.js'
import { mkdirSync } from 'fs'
import { KIND, getCodecs } from '../public/js/dataModel/CODECS.js'
import { ignored, watchfs } from '../src/watchfs.js'

console.log('argv', process.argv)

program
  .name('fspeer')
  .option('--path <string>', 'directory to sync')
  .option('--prefix <string>', 'prefix to add to filename keys', '')
  .option('--s3port <number>', 'port for s3 proxy', x => +x, 1024)
  .option('--s3host <string>', 'host for s3 proxy', 'turtledb.com')
  .option('--name <string>', 'username')
  .option('--pass <string>', 'password')
  .option('--turtlename <string>', 'identifier')
  .parse()

let { path, prefix, s3port, s3host, name, pass, turtlename } = program.opts()
console.log({ path, prefix, s3port, s3host, name, pass: '*'.repeat(pass?.length ?? 0), turtlename })
name ||= process.env.TURTLEDB_COM_FS_USER || question('username: ')
pass ||= process.env.TURTLEDB_COM_FS_PASS || question('password: ', { hideEchoBack: true })
turtlename ||= process.env.TURTLEDB_COM_FS_TURTLENAME || question('turtlename [home]: ') || 'home'

const recaller = new Recaller('fspeer')

const hashword = await hashNameAndPassword(name, pass)
const privateKey = await hashNameAndPassword(turtlename, hashword)
const committer = new Committer(turtlename, privateKey, recaller)
const compactPublicKey = committer.compactPublicKey
console.log('cpk', compactPublicKey)

getPointerByPublicKey(compactPublicKey, recaller, committer)

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
  const loadedLayers = committer.layerIndex ?? -1
  const availableLength = global.peer?.remoteExports?.lookup?.()?.[compactPublicKey]?.want?.[0]?.[0]
  console.log('our length:', loadedLayers + 1, 'their length:', availableLength)
  if (availableLength !== undefined && loadedLayers === availableLength - 1) {
    startedLoading = true
    console.log('stop watching')
    const valueRefs = committer.workspace.getRefs('value') || {}
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

const root = join(process.cwd(), path)
mkdirSync(dirname(root), { recursive: true })

watchfs(committer, recaller, root, prefix, true)
