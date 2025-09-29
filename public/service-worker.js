/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="webworker"/>
/* global self */

import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'
import { TurtleDB } from './js/turtle/connections/TurtleDB.js'
import { Signer } from './js/turtle/Signer.js'
import { defaultPublicKey, handleRedirect } from './js/utils/handleRedirect.js'
import { logError, logInfo } from './js/utils/logger.js'
import { withoutServiceWorker } from './js/utils/webSocketMuxFactory.js'

/**
 * @typedef {import('./js/turtle/connections/TurtleDB.js').TurtleBranchStatus} TurtleBranchStatus
 */

const turtleDB = new TurtleDB('service-worker')
logInfo(() => console.log('-- service-worker started'))
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
          logInfo(() => console.log(`allClients.includes(client): ${allClients.includes(client)}`))
          client.postMessage(u8aTurtle.uint8Array.buffer)
        }
      })()
      tbMuxAndClientById[client.id] = { tbMux, client }
    }
    return tbMuxAndClientById[client.id].tbMux
  } catch (error) {
    logError(() => console.error(error))
    throw error
  }
}

serviceWorkerGlobalScope.addEventListener('install', async () => {
  logInfo(() => console.log('-- service-worker install'))
})

serviceWorkerGlobalScope.addEventListener('activate', async event => {
  logInfo(() => console.log('-- service-worker activate'))
  event.waitUntil(serviceWorkerGlobalScope.clients.claim())
  logInfo(() => console.log('-- service-worker activate clients claimed'))
})

serviceWorkerGlobalScope.addEventListener('message', async messageEvent => {
  // logInfo(() => console.log('-- service-worker message'))
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
  const redirectPromise = handleRedirect(
    url.pathname,
    +url.searchParams.get('address'),
    turtleDB,
    defaultPublicKey,
    href => {
      return Response.redirect(href, 302)
    },
    (type, body) => {
      if (body) {
        const contentType = contentTypeByExtension[type] || 'application/octet-stream'
        const response = new Response(new Blob([body], { headers: { type: contentType } }), { headers: { 'Content-Type': contentType } })
        return response
      }
    }
  )
  fetchEvent.respondWith(redirectPromise)
})

withoutServiceWorker(turtleDB)
