#!/usr/bin/env node

import { connect } from 'net'
import { program } from 'commander'
import { start } from 'repl'
import { Recaller } from '../public/js/utils/Recaller.js'
import { Committer } from '../public/js/dataModel/Committer.js'
import { hashNameAndPassword } from '../public/js/utils/crypto.js'
import { newPeerPerCycle } from '../public/js/utils/peerFactory.js'

program
  .name('repl')
  .option('--port <number>', 'port number for net connection', x => +x, 1024)
  .parse()
const { port } = program.opts()

const recaller = new Recaller('repl')

if (port) {
  global.login = async (username, password, pathname = 'home') => {
    const hashword = await hashNameAndPassword(username, password)
    const privateKey = await hashNameAndPassword(pathname, hashword)
    const committer = new Committer(pathname, privateKey, recaller)
    const compactPublicKey = committer.compactPublicKey
    global.peer.addSourceObject(compactPublicKey, `repl sourceObject ${username}/${pathname}/${compactPublicKey}`, committer)
    return committer
  }
  console.log('login function added to global namespace')

  const connectionCycle = (receive, setSend, peer) => new Promise((resolve, reject) => {
    global.peer = peer
    console.log('outer')
    const socket = connect(port, () => {
      console.log('inner')
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
