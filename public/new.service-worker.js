/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="webworker"/>

import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'

/* global self, location, WebSocket, clients */

console.log('service-worker started')
/** @type {ServiceWorkerGlobalScope} */
const sw = self

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

sw.addEventListener('install', async () => {
  console.log('service-worker install')
})

sw.addEventListener('activate', async () => {
  console.log('service-worker activate')
})

sw.addEventListener('message', async messageEvent => {
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
    const ws = new WebSocket(url)
    sw.tbMux = tbMux
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      console.log('onopen')
      let lastIndex = -1
      tbMux.recaller.watch('webclient tbMux to ws', () => {
        while (tbMux.outgoingBranch.index > lastIndex) {
          ++lastIndex
          ws.send(tbMux.outgoingBranch.u8aTurtle.getAncestorByIndex(lastIndex).uint8Array)
        }
      })
      t = 100
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
  t = Math.min(t, 2 * 60 * 1000) // 2 minutes
  t = t * (1 + Math.random()) // exponential backoff and some jitter
  console.log('waiting', t, 'ms')
  await new Promise(resolve => setTimeout(resolve, t))
}
