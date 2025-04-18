/* global location, WebSocket */

import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'

const cpk = document.baseURI.match(/(?<=\/)[0-9A-Za-z]{41,51}(?=\/)/)?.[0]

console.log(cpk)

const url = `wss://${location.host}`

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
    const tbMux = new TurtleBranchMultiplexer('websocket')
    const ws = new WebSocket(url)
    window.cpk = cpk
    window.tbMux = tbMux
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
