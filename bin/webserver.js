#!/usr/bin/env node

import { program } from 'commander'
import express from 'express'
import { connect } from 'net'
import { join } from 'path'
import { createServer as createHttpsServer } from 'https'
import { createServer as createHttpServer } from 'http'
import { WebSocketServer } from 'ws'
import { Peer } from '../public/js/net/Peer.js'
import { Recaller } from '../public/js/utils/Recaller.js'
import { manageCert } from '../src/manageCert.js'
import { attachPeerToCycle, newPeerPerCycle } from '../public/js/utils/peerFactory.js'

program
  .name('webserver')
  .option('--port <number>', 'port for web client', x => +x, 8080)
  .option('--s3port <number>', 'port for s3 proxy', x => +x, 1024)
  .option('--s3host <string>', 'host for s3 proxy')
  .option('--path <string>', 'paths to serve files from', (v, prev) => [...prev, v], [])
  .option('--https', 'use https', false)
  .option('--insecure', '(local dev) allow unauthorized', false)
  .option('--certpath <string>', '(local dev) path to self-cert', 'dev/cert.json')
  .parse()

const { port, s3port, s3host, path: paths, https, insecure, certpath } = program.opts()

const app = express()
app.use((req, _res, next) => {
  console.log(req.method, req.url)
  next()
})

for (const path of paths) {
  let [filepath, webpath] = path.split(/:/)
  webpath ??= filepath
  const fullpath = join(process.cwd(), filepath)
  console.log(fullpath, webpath)
  app.use(webpath, express.static(fullpath))
}

let server
if (https || insecure) {
  if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  const fullcertpath = join(process.cwd(), certpath)
  const certOptions = await manageCert(fullcertpath)
  server = createHttpsServer(certOptions, app)
} else {
  server = createHttpServer(app)
}

const wss = new WebSocketServer({ server })
const recaller = new Recaller('webserver')
let count = 0

wss.on('connection', ws => {
  const peer = new Peer(`[webserver.js to wss-connection#${count++}]`, recaller)
  const connectionCycle = (receive, setSend) => new Promise((resolve, reject) => {
    ws.on('message', buffer => receive(new Uint8Array(buffer)))
    ws.onclose = resolve
    ws.onerror = reject
    setSend(uint8Array => ws.send(uint8Array.buffer))
  })
  attachPeerToCycle(peer, connectionCycle)
})

server.listen(port, () => {
  console.log(`webserver started: ${(https || insecure) ? 'https' : 'http'}://localhost:${port}`)
})

console.log({ s3port, s3host })
if (s3port) {
  const netConnectionCycle = (receive, setSend) => new Promise((resolve, reject) => {
    let socket
    if (s3host) {
      socket = connect(s3port, s3host, () => {
        console.log('connected')
        setSend(uint8Array => socket.write(uint8Array))
      })
      console.log('connecting', s3port, s3host)
    } else {
      socket = connect(s3port, () => {
        setSend(uint8Array => socket.write(uint8Array))
      })
    }
    socket.on('data', data => {
      receive(new Uint8Array(data.buffer, data.byteOffset, data.length / Uint8Array.BYTES_PER_ELEMENT))
    })
    socket.on('error', reject)
    socket.on('end', resolve)
  })
  newPeerPerCycle('[webserver.js to s3peer]', recaller, netConnectionCycle)
}
