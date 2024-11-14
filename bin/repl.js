#!/usr/bin/env node

import { connect, createServer } from 'net'
import { program } from 'commander'
import { start } from 'repl'
import { attachPeerToCycle, newPeerPerCycle } from '../public/js/utils/peerFactory.js'
import { Peer, peerRecaller } from '../public/js/net/Peer.js'

program
  .name('repl')
  .option('--s3port <number>', 'port for s3 proxy', x => +x, 1024)
  .option('--s3host <string>', 'host for s3 proxy', 'turtledb.com')
  .option('--port <number>', 'host for s3 proxy', x => +x)
  .parse()
const { s3port, s3host, port } = program.opts()

const recaller = peerRecaller

if (port) {
  global.peer = new Peer('repl-as-host')
  const server = createServer(socket => {
    const connectionCycle = (receive, setSend) => new Promise((resolve, reject) => {
      socket.on('end', resolve)
      socket.on('error', reject)
      socket.on('data', data => {
        receive(new Uint8Array(data))
      })
      setSend(uint8Array => socket.write(uint8Array))
    })
    const peer = new Peer('[repl as host]')
    attachPeerToCycle(peer, connectionCycle)
  })
  server.listen(+port, () => {
    console.log(`s3peer net server listening on port ${port}`)
  })
} else {
  const connectionCycle = (receive, setSend, peer) => new Promise((resolve, reject) => {
    global.peer = peer
    console.log('#####   global.peer is set')
    const socket = connect(s3port, s3host, () => {
      console.log('[repl to s3peer] is connected.')
      socket.on('data', data => {
        receive(new Uint8Array(data.buffer))
      })
      socket.on('close', resolve)
      setSend(uint8Array => socket.write(uint8Array))
    }).on('error', reject)
  })
  newPeerPerCycle('[repl to s3peer]', recaller, connectionCycle, true)
}

const replServer = start({ breakEvalOnSigint: true })
replServer.on('exit', process.exit)
