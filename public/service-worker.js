/* global self, location, WebSocket, clients */

import { getCommitAddress } from './js/dataModel/Uint8ArrayLayerPointer.js'
import { Peer, getPublicKeys, peerRecaller, getPointerByPublicKey } from './js/net/Peer.js'
import { attachPeerToCycle, newPeerPerCycle } from './js/utils/peerFactory.js'
import { fallbackCPK } from './js/constants.js'

console.log(' @@@ fallbackCPK', fallbackCPK)
getPointerByPublicKey(fallbackCPK)

export const v = '0.0.11'
self.v = v

const recaller = peerRecaller

let ws
const peersById = {}
const receiveById = {}
const updateClients = async eventName => {
  const currentIds = (await clients?.matchAll?.() ?? []).map(client => client.id)
  for (const peerId in peersById) {
    if (!currentIds.includes(peerId)) {
      console.log(` @@@ removing detached peer with id === '${peerId}'`)
      peersById[peerId].cleanup()
      delete peersById[peerId]
      delete receiveById[peerId]
    }
  }
  if (ws?.readyState === undefined) {
    console.log(' @@@ creating connectionCycle. ws.readyState', ws?.readyState)
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
  }
}

self.addEventListener('install', async () => {
  updateClients('install')
  // await self.skipWaiting
})

const name = `service-worker.js#${v}`
self.addEventListener('activate', event => {
  event.waitUntil(clients.claim())
  updateClients('activate')
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
  recaller.watch('populate cache', () => {
    const cpks = getPublicKeys()
    for (const cpk of cpks) {
      const pointer = getPointerByPublicKey(cpk, recaller)

      const fsRefs = pointer.lookupRefs(getCommitAddress(pointer), 'value', 'fs')
      if (!fsRefs) return

      Object.keys(fsRefs).forEach(relativePath => {
        if (fsRefs[relativePath] === fallbackRefs[relativePath]) return
        const address = fsRefs[relativePath]
        let file = pointer.lookup(address)
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
        if (cpk === fallbackCPK) cache.put(absolutePath, new Response(file, { headers }))
        cache.put(`${absolutePath}?address=${address}&cpk=${cpk}`, new Response(file, { headers }))
        console.log(' @@@ caching', `${absolutePath}?address=${address}&cpk=${cpk}`)
        if (indexed !== undefined) {
          cache.put(indexed, new Response(file, { headers }))
          cache.put(`${indexed}/`, new Response(file, { headers }))
        }
      })
    }
  })
})

self.addEventListener('fetch', event => {
  updateClients('fetch')
  event.respondWith((async () => {
    const cache = await self.caches.open(v)
    const response = await cache.match(event.request)
    if (response) return response
    const url = new URL(event.request.url)
    const address = +url.searchParams.get('address')
    const cpk = url.searchParams.get('cpk')
    if (address && cpk) {
      const pointer = getPointerByPublicKey(cpk)
      const extension = url.pathname.split(/\./).pop()
      let file = pointer.lookup(address)
      console.log(' @@@ trying to add cache for', { address, cpk, extension, fileLength: file?.length })
      if (file !== undefined) {
        try {
          if (extension === 'json') {
            file = JSON.stringify(file, null, 10)
          }
          const headers = new Headers({
            'Content-Type': contentTypeByExtension[extension]
          })
          return new Response(file, { headers })
        } catch (error) {
          console.error(error)
        }
      }
    }
    console.log(' @@@ unmatched fetch request', event.request.url, response)
    return fetch(event.request)
  })())
})

self.addEventListener('message', message => {
  updateClients('message')
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
