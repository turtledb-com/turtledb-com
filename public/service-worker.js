/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="webworker"/>

import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'
import { TurtleDB } from './js/turtle/connections/TurtleDB.js'

/* global self, location, WebSocket */

const url = `wss://${location.host}`
const turtleDB = new TurtleDB('service-worker')

console.log('service-worker started')
/** @type {ServiceWorkerGlobalScope} */
const serviceWorkerGlobalScope = self

/** @type {Object.<string, {tbMux:TurtleBranchMultiplexer, client:Client}} */
const tbMuxAndClientById = {}
/**
 * @param {Client} client
 * @returns {TurtleBranchMultiplexer}
 */
const getTBMuxForClient = client => {
  if (!tbMuxAndClientById[client.id]) {
    const tbMux = new TurtleBranchMultiplexer(client.id, true, turtleDB)
    ;(async () => {
      for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
        // if (ws.readyState !== ws.OPEN) break
        // ws.send(u8aTurtle.uint8Array)
        client.postMessage(u8aTurtle.uint8Array.buffer)
      }
    })()
    tbMuxAndClientById[client.id] = { tbMux, client }
  }
  return tbMuxAndClientById[client.id].tbMux
}

serviceWorkerGlobalScope.addEventListener('install', async () => {
  console.log('service-worker install')
})

serviceWorkerGlobalScope.addEventListener('activate', async () => {
  console.log('service-worker activate')
})

serviceWorkerGlobalScope.addEventListener('message', async messageEvent => {
  console.log('service-worker activate')
  const tbMux = getTBMuxForClient(messageEvent.source)
  tbMux.incomingBranch.append(new Uint8Array(messageEvent.data))
})

const contentTypeByExtension = {
  css: 'text/css',
  html: 'text/html',
  js: 'application/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  webmanifest: 'application/manifest+json'
}

serviceWorkerGlobalScope.addEventListener('fetch', fetchEvent => {
  const url = fetchEvent.request.url
  // console.log('service-worker fetch', url)
  fetchEvent.respondWith((async () => {
    let extension = url.split(/[#?]/)[0].split('.').pop()
    const matchGroups = url.match(/\/(?<publicKey>[0-9A-Za-z]{41,51})\/(?<relativePath>.*)$/)?.groups
    if (matchGroups) {
      let { publicKey, relativePath } = matchGroups
      if (!relativePath.length || relativePath.endsWith('/')) {
        extension = 'html'
        relativePath = `${relativePath}index.html`
      }
      const turtleBranch = await turtleDB.summonBoundTurtleBranch(publicKey)
      const body = turtleBranch.lookup('document', 'value', 'fs', relativePath)
      if (body) {
        const contentType = contentTypeByExtension[extension]
        // console.log({ publicKey, relativePath, extension, contentType })
        return new Response(new Blob([body], { headers: { type: contentType } }), { headers: { 'Content-Type': contentType } })
      }
    }
    return fetch(fetchEvent.request)
  })())
})

;(async () => {
  let t = 100
  let connectionCount = 0
  while (true) {
    console.log('-- creating new websocket and mux')
    const tbMux = new TurtleBranchMultiplexer(`websocket#${connectionCount}`, false, turtleDB)
    for (const publicKey of turtleDB.getPublicKeys()) {
      await tbMux.getTurtleBranchUpdater(publicKey)
    }
    const tbMuxBinding = async status => {
    // console.log('tbMuxBinding about to get next', { publicKey })
      const updater = await tbMux.getTurtleBranchUpdater(status.turtleBranch.name, status.publicKey, status.turtleBranch)
      // console.log('tbMuxBinding about to await settle', { updater })
      await updater.settle
    // console.log('tbMuxBinding', { publicKey })
    }
    turtleDB.bind(tbMuxBinding)
    let _connectionCount
    try {
      const ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      ws.onopen = async () => {
        ;(async () => {
          for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
            if (ws.readyState !== ws.OPEN) break
            ws.send(u8aTurtle.uint8Array)
          }
        })()
        t = 100
        _connectionCount = ++connectionCount
        console.log('-- onopen', { _connectionCount })
      }
      ws.onmessage = event => {
        tbMux.incomingBranch.append(new Uint8Array(event.data))
      }
      await new Promise((resolve, reject) => {
        ws.onclose = resolve
        ws.onerror = reject
      })
    } catch (error) {
      console.error(error)
    }
    tbMux.stop()
    turtleDB.unbind(tbMuxBinding)
    t = Math.min(t, 2 * 60 * 1000) // 2 minutes max (unjittered)
    t = t * (1 + Math.random()) // exponential backoff and some jitter
    console.log('waiting', t, 'ms')
    await new Promise(resolve => setTimeout(resolve, t))
  }
})()
