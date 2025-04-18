/* global location, WebSocket */

import { AS_REFS } from './js/turtle/codecs/CodecType.js'
import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'
import { Signer } from './js/turtle/Signer.js'
import { TurtleBranch } from './js/turtle/TurtleBranch.js'
import { TurtleDictionary } from './js/turtle/TurtleDictionary.js'
import { Workspace } from './js/turtle/Workspace.js'
import { proxyWithRecaller } from './js/utils/proxyWithRecaller.js'
import { Recaller } from './js/utils/Recaller.js'

const cpk = document.baseURI.match(/(?<=\/)[0-9A-Za-z]{41,51}(?=\/)/)?.[0]
window.cpk = cpk
window.TurtleDictionary = TurtleDictionary
window.Signer = Signer
window.Workspace = Workspace
window.AS_REFS = AS_REFS

console.log(cpk)

const url = `wss://${location.host}`
const recaller = new Recaller('web client')

/** @type {Object.<string, TurtleBranch>} */
const turtleRegistry = proxyWithRecaller({}, recaller)
window.turtleRegistry = turtleRegistry
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
  console.log('creating new websocket and mux')
  const tbMux = new TurtleBranchMultiplexer('websocket', true)
  const addTurtleRegistry = () => {
    for (const publicKey in turtleRegistry) {
      const turtleBranch = turtleRegistry[publicKey]
      tbMux.getTurtleBranchUpdater(TurtleBranch.name, publicKey, turtleBranch)
    }
  }
  try {
    const ws = new WebSocket(url)
    window.tbMux = tbMux
    ws.binaryType = 'arraybuffer'
    const startOutgoingLoop = async () => {
      for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
        if (ws.readyState !== ws.OPEN) break
        console.log('sending')
        ws.send(u8aTurtle.uint8Array)
      }
    }
    const startIncomingLoop = async () => {
      for await (const u8aTurtle of tbMux.incomingBranch.u8aTurtleGenerator()) {
        if (ws.readyState !== ws.OPEN) break
        const update = u8aTurtle.lookup()
        if (update?.publicKey && !turtleRegistry[update.publicKey]) {
          console.log('adding missing from incoming')
          window.getTurtleBranchByPublicKey(update.publicKey, update.name)
        }
      }
    }
    const updatersByKey = {}
    window.getTurtleBranchByPublicKey = async (publicKey, name = publicKey) => {
      if (!turtleRegistry[publicKey]) {
        if (!updatersByKey[publicKey]) {
          console.log('adding manually', publicKey)
          updatersByKey[publicKey] = tbMux.getTurtleBranchUpdater(name, publicKey)
        }
        await updatersByKey[publicKey].settle
        turtleRegistry[publicKey] ??= updatersByKey[publicKey].turtleBranch
      }
      return turtleRegistry[publicKey]
    }
    ws.onopen = async () => {
      console.log('onopen')
      addTurtleRegistry()
      startOutgoingLoop() // don't await
      startIncomingLoop() // don't await
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
  delete window.tbMux
  window.getTurtleBranchByPublicKey = _getTurtleBranchByPublicKey
  t = Math.min(t, 2 * 60 * 1000) // 2 minutes
  t = t * (1 + Math.random()) // exponential backoff and some jitter
  console.log('waiting', t, 'ms')
  await new Promise(resolve => setTimeout(resolve, t))
}
