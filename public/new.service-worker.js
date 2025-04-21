/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="webworker"/>

import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'
import { Recaller } from './js/utils/Recaller.js'

/* global self, location, WebSocket, clients */

const recaller = new Recaller('service-worker')

console.log('service-worker started')
/** @type {ServiceWorkerGlobalScope} */
const serviceWorkerGlobalScope = self

/** @type {Object.<string, {tbMux:TurtleBranchMultiplexer, client:Client}} */
const tbMuxAndClientById = {}

/**
 * @param {Client} client
 * @returns {TurtleBranchMultiplexer}
 */
const getTbMuxForClient = client => {
  if (!tbMuxAndClientById[client.id]) {
    const tbMux = new TurtleBranchMultiplexer(client.id, false)
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
  const tbMux = getTbMuxForClient(messageEvent.source)
  tbMux.incomingBranch.append(new Uint8Array(messageEvent.data))
})

function getWebSocketMux () {

}

const url = `wss://${location.host}`
let t = 100
while (true) {
  try {
    console.log('creating new websocket and mux')
    const tbMux = new TurtleBranchMultiplexer('websocket')
    const webSocket = new WebSocket(url)
    serviceWorkerGlobalScope.tbMux = tbMux
    webSocket.binaryType = 'arraybuffer'
    webSocket.onopen = async () => {
      console.log('onopen')
      for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
        if (webSocket.readyState !== webSocket.OPEN) break
        webSocket.send(u8aTurtle.uint8Array)
      }
    }
    webSocket.onmessage = event => {
      tbMux.incomingBranch.append(new Uint8Array(event.data))
    }
    await new Promise((resolve, reject) => {
      webSocket.onclose = resolve
      webSocket.onerror = reject
    })
  } catch (error) {
    console.error(error)
  }
  t = Math.min(t, 2 * 60 * 1000) // 2 minutes
  t = t * (1 + Math.random()) // exponential backoff and some jitter
  console.log('waiting', t, 'ms')
  await new Promise(resolve => setTimeout(resolve, t))
}
