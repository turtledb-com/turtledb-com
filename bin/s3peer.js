#!/usr/bin/env node

import { program } from 'commander'
import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { Recaller } from '../public/js/utils/Recaller.js'
import { bigLabel } from '../public/js/utils/loggy.js'
import { S3Peer } from '../src/S3Peer.js'
import { createServer } from 'net'
import { attachPeerToCycle } from '../public/js/utils/peerFactory.js'

program
  .name('s3peer')
  .description('Sync all turtles into an s3 style bucket')
  .option('--endpoint <string>', 'From control panel / settings')
  .option('--bucket <string>', 'S3 style bucket')
  .option('--forcePathStyle', 'Configures to use subdomain/virtual calling format.', false)
  .option('--region <string>', 'Usually the region in your endpoint.')
  .option('--port <number>', 'port number for net connection', x => +x, 1024)
  .option('--verbose', 'log every commit', false)
  .parse()

const { endpoint, bucket, forcePathStyle, region, port, verbose } = program.opts()

const accessKeyId = process.env.SPACES_ROOT_ACCESS
const secretAccessKey = process.env.SPACES_ROOT_SECRET

const label = (title, f) => verbose && bigLabel(title, f)

/** @type {import('@aws-sdk/client-s3').S3ClientConfig} */
const s3ClientConfig = {
  endpoint,
  forcePathStyle,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey
  }
}
label('s3ClientConfig', () => console.dir(s3ClientConfig))

const s3Client = new S3Client(s3ClientConfig)
const listBucketsResponse = await s3Client.send(new ListBucketsCommand({}))
label('listBucketsResponse', () => console.dir(listBucketsResponse))

const name = `peer.${randomUUID()}`
const recaller = new Recaller(`${name}.recaller`)

if (port) {
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
