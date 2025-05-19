/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="webworker"/>
/* global self, location, WebSocket */

import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'
import { TurtleDB } from './js/turtle/connections/TurtleDB.js'
import { Signer } from './js/turtle/Signer.js'

/**
 * @typedef {import('./js/turtle/connections/TurtleDB.js').TurtleBranchStatus} TurtleBranchStatus
 */

const url = `wss://${location.host}`
const turtleDB = new TurtleDB('service-worker')

console.log('-- service-worker started')
/** @type {ServiceWorkerGlobalScope} */
const serviceWorkerGlobalScope = self
serviceWorkerGlobalScope.turtleDB = turtleDB
serviceWorkerGlobalScope.Signer = Signer

/** @type {Object.<string, {tbMux:TurtleBranchMultiplexer, client:Client}} */
const tbMuxAndClientById = {}
/**
 * @param {Client} client
 * @returns {TurtleBranchMultiplexer}
 */
const getTBMuxForClient = client => {
  try {
    if (!tbMuxAndClientById[client.id]) {
      const tbMux = new TurtleBranchMultiplexer(`client_#${client.id}`, true, turtleDB)
      ;(async () => {
        for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
        // if (ws.readyState !== ws.OPEN) break
        // ws.send(u8aTurtle.uint8Array)
          const allClients = await serviceWorkerGlobalScope.clients.matchAll()
          console.log(`allClients.includes(client): ${allClients.includes(client)}`)
          client.postMessage(u8aTurtle.uint8Array.buffer)
        }
      })()
      tbMuxAndClientById[client.id] = { tbMux, client }
    }
    return tbMuxAndClientById[client.id].tbMux
  } catch (error) {
    console.error(error)
    throw error
  }
}

serviceWorkerGlobalScope.addEventListener('install', async () => {
  console.log('-- service-worker install')
})

serviceWorkerGlobalScope.addEventListener('activate', async event => {
  console.log('-- service-worker activate')
  event.waitUntil(serviceWorkerGlobalScope.clients.claim())
  console.log('-- service-worker activate clients claimed')
})

serviceWorkerGlobalScope.addEventListener('message', async messageEvent => {
  // console.log('-- service-worker message')
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
  const url = new URL(fetchEvent.request.url)
  const { pathname, searchParams } = url
  const matchGroups = pathname.match(/\/(?<urlPublicKey>[0-9A-Za-z]{41,51})(?<slash>\/?)(?<relativePath>.*)$/)?.groups
  // console.log('service-worker fetch', url)
  try {
    if (matchGroups?.urlPublicKey) {
      const { urlPublicKey, slash, relativePath } = matchGroups
      const isDir = !relativePath || relativePath.endsWith('/')
      if (!slash) {
        url.pathname = `/${urlPublicKey}/${relativePath}`
      }
      if (isDir) {
        url.pathname = `${url.pathname}index.html`
      }
      if (!slash || isDir) {
        fetchEvent.respondWith(Response.redirect(url.toString(), 301))
      } else {
        const type = pathname.split('.').pop()
        fetchEvent.respondWith(turtleDB.summonBoundTurtleBranch(urlPublicKey).then(turtleBranch => {
          const address = +searchParams.get('address')
          const body = address ? turtleBranch.lookup(address) : turtleBranch?.lookup?.('document', 'value', 'fs', relativePath)
          if (body) {
            const contentType = contentTypeByExtension[type]
            const response = new Response(new Blob([body], { headers: { type: contentType } }), { headers: { 'Content-Type': contentType } })
            return response
          }
        }))
      }
    }
  } catch (error) {
    console.error(error)
  }
})

;(async () => {
  let t = 100
  let connectionCount = 0
  while (true) {
    const _connectionCount = ++connectionCount
    console.log('-- creating new websocket and mux')
    console.time('-- websocket lifespan')
    const tbMux = new TurtleBranchMultiplexer(`websocket_#${connectionCount}`, false, turtleDB)
    for (const publicKey of turtleDB.getPublicKeys()) {
      await tbMux.getTurtleBranchUpdater(publicKey)
    }
    const tbMuxBinding = async (/** @type {TurtleBranchStatus} */ status) => {
      console.log('tbMuxBinding about to get next', { _connectionCount })
      const updater = await tbMux.getTurtleBranchUpdater(status.turtleBranch.name, status.publicKey, status.turtleBranch)
      console.log('updater about to await settle', updater.name)
      await updater.settle
      console.log('updater settled')
      console.log('tbMuxBinding', { _connectionCount })
    }
    turtleDB.bind(tbMuxBinding)
    try {
      const ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      ws.onopen = async () => {
        ;(async () => {
          try {
            for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
              if (ws.readyState !== ws.OPEN) break
              ws.send(u8aTurtle.uint8Array)
            }
          } catch (error) {
            console.error(error)
          }
        })()
        t = 100
        console.log('-- onopen', { _connectionCount })
      }
      ws.onmessage = event => {
        if (event.data.byteLength) tbMux.incomingBranch.append(new Uint8Array(event.data))
        else console.log('-- keep-alive')
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
    console.timeEnd('-- websocket lifespan')
    t = Math.min(t, 2 * 60 * 1000) // 2 minutes max (unjittered)
    t = t * (1 + Math.random()) // exponential backoff and some jitter
    console.log(`-- waiting ${(t / 1000).toFixed(2)}s`)
    await new Promise(resolve => setTimeout(resolve, t))
  }
})()
