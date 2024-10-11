#!/usr/bin/env node

import { connect } from 'net'
import { program } from 'commander'
import { start } from 'repl'
import { Recaller } from '../public/js/utils/Recaller.js'
import { newPeerPerCycle } from '../public/js/utils/peerFactory.js'

program
  .name('repl')
  .option('--s3port <number>', 'port for s3 proxy', x => +x, 1024)
  .option('--s3host <string>', 'host for s3 proxy', 'turtledb.com')
  .parse()
const { s3port, s3host } = program.opts()

const recaller = new Recaller('repl')

const connectionCycle = (receive, setSend, peer) => new Promise((resolve, reject) => {
  global.peer = peer
  console.log('#####   global.peer is set')
  const socket = connect(s3port, s3host, () => {
    console.log('<socket to s3peer is connected.>')
    socket.on('data', data => {
      receive(new Uint8Array(data.buffer))
    })
    socket.on('close', resolve)
    setSend(uint8Array => socket.write(uint8Array))
  }).on('error', reject)
})
newPeerPerCycle('[repl to s3peer]', recaller, connectionCycle, true)

const replServer = start({ breakEvalOnSigint: true })
replServer.on('exit', process.exit)
