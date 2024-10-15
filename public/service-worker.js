/* global self, location, WebSocket, clients */

import { fallbackCPK } from './js/constants.js'
import { getCommitAddress } from './js/dataModel/Uint8ArrayLayerPointer.js'
import { Peer, peerRecaller, setPointerByPublicKey } from './js/net/Peer.js'
import { attachPeerToCycle, newPeerPerCycle } from './js/utils/peerFactory.js'

export const v = `0.0.3.rnd${Math.floor(Math.random() * 1000)}`
self.v = v

const recaller = peerRecaller

self.addEventListener('install', async () => {
  console.log('install')
  await self.skipWaiting
})

const name = `service-worker.js#${v}`
let ws
self.addEventListener('activate', event => {
  console.log('activate')
  event.waitUntil(clients.claim())
  const url = `wss://${location.host}`
  const connectionCycle = (receive, setSend) => new Promise((resolve, reject) => {
    ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      setSend(uint8Array => ws.send(uint8Array.buffer))
    }
    ws.onmessage = event => {
      receive(new Uint8Array(event.data))
    }
    ws.onclose = resolve
    ws.onerror = reject
  })
  newPeerPerCycle(`[${name} to WebSocket]`, recaller, connectionCycle, true)
})

const contentTypeByExtension = {
  css: 'text/css',
  html: 'text/html',
  js: 'application/javascript',
  json: 'application/json',
  svg: 'image/svg+xml'
}
const fallbackRefs = {}
self.caches.open(v).then(cache => {
  const fallbackPointer = setPointerByPublicKey(fallbackCPK, recaller)
  recaller.watch('populate cache', () => {
    const fsRefs = fallbackPointer.lookupRefs(getCommitAddress(fallbackPointer), 'value', 'fs')
    if (!fsRefs) return

    Object.keys(fsRefs).forEach(relativePath => {
      if (fsRefs[relativePath] === fallbackRefs[relativePath]) return
      const address = fsRefs[relativePath]
      let file = fallbackPointer.lookup(address)
      const absolutePath = `/${relativePath}`
      const indexed = absolutePath.match(/(?<indexed>.*)\/index.html?/)?.groups?.indexed
      const extension = relativePath.split(/\./).pop()
      try {
        if (extension === 'json') {
          file = JSON.stringify(file, null, 10)
        }
      } catch (error) {
        console.error(error)
        return
      }
      fallbackRefs[relativePath] = address
      const headers = new Headers({
        'Content-Type': contentTypeByExtension[extension]
      })
      cache.put(absolutePath, new Response(file, { headers }))
      cache.put(`${absolutePath}?address=${address}&cpk=${fallbackCPK}`, new Response(file, { headers }))
      if (indexed !== undefined) {
        cache.put(indexed, new Response(file, { headers }))
        cache.put(`${indexed}/`, new Response(file, { headers }))
      }
    })
  })
})

self.addEventListener('fetch', event => {
  event.respondWith((async () => {
    const cache = await self.caches.open(v)
    const response = await cache.match(event.request)
    if (response) return response
    console.log('unmatched fetch request', event.request.url, response)
    return fetch(event.request)
  })())
})

const peersById = {}
const receiveById = {}

self.addEventListener('message', message => {
  // console.log('message')
  if (ws?.readyState !== 1) {
    console.error(new Error(`ws.readyState: ${ws?.readyState}`))
  }
  const client = message.source
  const id = client.id
  if (!peersById[id]) {
    peersById[id] = new Peer(`[${name} to ${id}]`, recaller)
    const connectionCycle = (receive, setSend) => new Promise((resolve, reject) => {
      receiveById[id] = receive
      client.onmessage = event => {
        receive(new Uint8Array(event.data))
      }
      client.onclose = resolve
      client.onerror = reject
      setSend(uint8Array => client.postMessage(uint8Array.buffer))
    })
    attachPeerToCycle(peersById[id], connectionCycle)
  }
  receiveById[id](new Uint8Array(message.data))
})
