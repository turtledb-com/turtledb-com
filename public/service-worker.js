/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="webworker"/>
/* global self */

import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'
import { TurtleDB } from './js/turtle/connections/TurtleDB.js'
import { Signer } from './js/turtle/Signer.js'
import { logError, logInfo, logWarn } from './js/utils/logger.js'
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
  const { pathname, searchParams } = url
  const matchGroups = pathname.match(/\/(?<urlPublicKey>[0-9A-Za-z]{41,51})(?<slash>\/?)(?<relativePath>.*)$/)?.groups
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
        fetchEvent.respondWith(Response.redirect(url.toString(), 302))
      } else {
        const type = pathname.split('.').pop()
        fetchEvent.respondWith(turtleDB.summonBoundTurtleBranch(urlPublicKey).then(turtleBranch => {
          const address = +searchParams.get('address')
          const body = turtleBranch?.lookupFile(relativePath, false, address)
          if (body) {
            const contentType = contentTypeByExtension[type]
            const response = new Response(new Blob([body], { headers: { type: contentType } }), { headers: { 'Content-Type': contentType } })
            return response
          } else {
            try {
              const configJson = JSON.parse(turtleBranch?.lookupFile?.('config.json'))
              const branchGroups = ['fsReadWrite', 'fsReadOnly']
              for (const branchGroup of branchGroups) {
                const branches = configJson[branchGroup]
                if (branches) {
                  for (const { name, key } of branches) {
                    if (name && key) {
                      const nickname = `/${urlPublicKey}/${name}/`
                      if (pathname.startsWith(nickname)) {
                        const pathFromKey = pathname.slice(nickname.length)
                        url.pathname = `/${key}/${pathFromKey}`
                        return Response.redirect(url.toString(), 302)
                      }
                    }
                  }
                }
              }
            } catch {
              logWarn(() => console.warn('not found, no config', pathname))
            }
          }
        }))
      }
    }
  } catch (error) {
    logError(() => console.error(error))
  }
})

withoutServiceWorker(turtleDB)
