#!/usr/bin/env node

import { program } from 'commander'
import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { Recaller } from '../public/js/utils/Recaller.js'
import { bigLabel } from '../public/js/utils/loggy.js'
import { S3Peer } from '../src/S3Peer.js'
import { createServer as createNetServer } from 'net'
import { createServer as createHttpServer } from 'http'
import { attachPeerToCycle } from '../public/js/utils/peerFactory.js'

program
  .name('s3peer')
  .description('Sync all turtles into an s3 style bucket')
  .option('--endpoint <string>', 'From control panel / settings')
  .option('--bucket <string>', 'S3 style bucket')
  .option('--forcePathStyle', 'Configures to use subdomain/virtual calling format.', false)
  .option('--region <string>', 'Usually the region in your endpoint.')
  .option('--key <string>', 'access key (put private part in process.env[* this key value *])')
  .option('--port <number>', 'port number for net connection', x => +x, 1024)
  .option('--http', 'use http server', false)
  .option('--verbose', 'log every commit', false)
  .parse()

const { endpoint, bucket, forcePathStyle, region, key, port, http, verbose } = program.opts()

const label = (title, f) => verbose && bigLabel(title, f)

const secret = process.env[key]
/** @type {import('@aws-sdk/client-s3').S3ClientConfig} */
const s3ClientConfig = {
  endpoint,
  forcePathStyle,
  region,
  credentials: {
    accessKeyId: key,
    secretAccessKey: secret
  }
}
label('s3ClientConfig', () => console.dir(s3ClientConfig))

const s3Client = new S3Client(s3ClientConfig)
const listBucketsResponse = await s3Client.send(new ListBucketsCommand({}))
label('listBucketsResponse', () => console.dir(listBucketsResponse))

const name = `peer.${randomUUID()}`
const recaller = new Recaller(`${name}.recaller`)

if (port) {
  const createServer = http ? createHttpServer : createNetServer
  let count = 0
  const server = createServer(socket => {
    const peer = new S3Peer(s3Client, bucket, `[s3peer.js to ${name}#${count++}]`, recaller)
    const connectionCycle = (receive, setSend) => new Promise((resolve, reject) => {
      socket.on('end', resolve)
      socket.on('error', reject)
      socket.on('data', data => {
        receive(new Uint8Array(data))
      })
      setSend(uint8Array => socket.write(uint8Array))
    })
    attachPeerToCycle(peer, connectionCycle)
  })
  server.listen(+port, () => {
    console.log(`s3peer net server listening on port ${port}`)
  })
}
