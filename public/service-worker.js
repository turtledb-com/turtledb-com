/* global self, location, WebSocket, clients */

import { Peer, getPublicKeys, peerRecaller, getPointerByPublicKey } from './js/net/Peer.js'
import { attachPeerToCycle, newPeerPerCycle } from './js/utils/peerFactory.js'
import { defaultCPK } from './js/constants.js'

console.log(' @@@ defaultCPK', defaultCPK)
getPointerByPublicKey(defaultCPK)

export const v = '0.0.14'

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
export const putVirtualCache = async (request, body) => {
  const extension = request.split(/\?/)[0].split(/\./).pop()
  const contentType = contentTypeByExtension[extension]
  try {
    if (extension === 'json') {
      body = JSON.stringify(body, null, 10)
    }
  } catch (error) {
    console.error(error)
    return
  }
  const headers = new Headers({
    'Content-Length': body.length,
    'Content-Type': contentType
  })
  const options = { headers }
  const response = new Response(body, options)
  const cache = await self.caches.open(v)
  console.log(' @@@ caching', request, contentType)
  cache.put(request, response)
}
recaller.watch('populate cache', () => {
  const cpks = getPublicKeys()
  for (const cpk of cpks) {
    const pointer = getPointerByPublicKey(cpk, recaller)
    try {
      const fsRefs = pointer.getRefs('value', 'fs')
      if (typeof fsRefs !== 'object') throw new Error('value.fs must be object')

      Object.keys(fsRefs).forEach(relativePath => {
        if (fsRefs[relativePath] === fallbackRefs[relativePath]) return
        const address = fsRefs[relativePath]
        const file = pointer.lookup(address)
        const absolutePath = `/${relativePath}`
        const indexed = absolutePath.match(/(?<indexed>.*)\/index.html?/)?.groups?.indexed
        fallbackRefs[relativePath] = address
        // const headers = new Headers({
        //   'Content-Type': contentTypeByExtension[extension]
        // })
        if (cpk === defaultCPK) {
          putVirtualCache(absolutePath, file)
          // cache.put(absolutePath, new Response(file, { headers }))
        }
        putVirtualCache(`${absolutePath}?address=${address}&cpk=${cpk}`, file)
        // cache.put(`${absolutePath}?address=${address}&cpk=${cpk}`, new Response(file, { headers }))
        // console.log(' @@@ caching', `${absolutePath}?address=${address}&cpk=${cpk}`, file.length)
        if (indexed !== undefined) {
          putVirtualCache(indexed, file)
          putVirtualCache(`${indexed}/`, file)
          // cache.put(indexed, new Response(file, { headers }))
          // cache.put(`${indexed}/`, new Response(file, { headers }))
        }
      })
    } catch (error) {
      console.error(error)
    }
  }
})

self.addEventListener('fetch', event => {
  console.log('fetch', event.request.url)
  updateClients('fetch')
  event.respondWith((async () => {
    const cache = await self.caches.open(v)
    const response = await cache.match(event.request)
    if (response) {
      console.log(' @@@ matched cache for', event.request.url)
      return response
    }
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
