/* global location, WebSocket */

import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'
import { TurtleBranch } from './js/turtle/TurtleBranch.js'
import { proxyWithRecaller } from './js/utils/proxyWithRecaller.js'
import { Recaller } from './js/utils/Recaller.js'

const cpk = document.baseURI.match(/(?<=\/)[0-9A-Za-z]{41,51}(?=\/)/)?.[0]

console.log(cpk)

const url = `wss://${location.host}`
const recaller = new Recaller('web client')

/** @type {Object.<string, TurtleBranch>} */
const turtleRegistry = proxyWithRecaller({}, recaller)
// s3 overrides this
const _getTurtleBranchByPublicKey = async (publicKey, name = publicKey) => {
  if (!turtleRegistry[publicKey]) {
    turtleRegistry[publicKey] = new TurtleBranch(name, recaller)
  }
  return turtleRegistry[publicKey]
}
window.getTurtleBranchByPublicKey = _getTurtleBranchByPublicKey

// const allServiceWorkers = new Set()
// try {
//   const serviceWorkerRegistration = await navigator.serviceWorker.register(
//     '/service-worker.js',
//     { type: 'module', scope: '/' }
//   )
//   console.log('register complete', serviceWorkerRegistration)
//   serviceWorkerRegistration.addEventListener('updatefound', () => {
//     console.log('service-worker update found')
//   })
//   try {
//     console.log(' ^^^^^^^ serviceWorkerRegistration.update()')
//     await serviceWorkerRegistration.update()
//   } catch (err) {
//     console.log(' ^^^^^^^ serviceWorkerRegistration.update() failed', err)
//   }
//   console.log(' ^^^^^^^ serviceWorkerRegistration.update() complete')
//   const { serviceWorker } = navigator
//   if (!serviceWorker || allServiceWorkers.has(serviceWorker)) throw new Error('no serviceWorker')
//   const { active } = await serviceWorker.ready
//   console.log({ active })
//   allServiceWorkers.add(serviceWorker)
//   const tbMux = new TurtleBranchMultiplexer('service-worker')
//   window.tbMux = tbMux
//   serviceWorker.onmessage = event => {
//     tbMux.incomingBranch.append(new Uint8Array(event.data))
//   }
//   /*
//   setPeer(recaller, peer)
//   serviceWorker.onmessage = event => receive(new Uint8Array(event.data))
//   serviceWorker.onmessageerror = event => console.log(peer.name, 'onmessageerror', event)
//   serviceWorker.startMessages()
//   setSend(uint8Array => active.postMessage(uint8Array.buffer))
//   await new Promise((resolve, reject) => {
//     serviceWorker.oncontrollerchange = resolve
//     serviceWorker.onerror = reject
//   })
//   */
// } catch (error) {
//   console.error(error)
// }

console.warn('unable to connect through service-worker, trying direct websocket connection')

let t = 100
while (true) {
  try {
    console.log('creating new websocket and mux')
    const tbMux = new TurtleBranchMultiplexer('websocket', true)
    for (const publicKey in turtleRegistry) {
      const turtleBranch = turtleRegistry[publicKey]
      tbMux.getTurtleBranchUpdater(TurtleBranch.name, publicKey, turtleBranch)
    }
    const ws = new WebSocket(url)
    window.cpk = cpk
    window.tbMux = tbMux
    ws.binaryType = 'arraybuffer'
    ws.onopen = async () => {
      console.log('onopen')
      for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
        if (ws.readyState !== ws.OPEN) break
        ws.send(u8aTurtle.uint8Array)
      }
    }
    ws.onmessage = event => {
      tbMux.incomingBranch.append(new Uint8Array(event.data))
      console.log(tbMux.incomingBranch.lookup())
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
