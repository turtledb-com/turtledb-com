/* global location, WebSocket */

import { AS_REFS } from './js/turtle/codecs/CodecType.js'
import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'
import { TurtleDB } from './js/turtle/connections/TurtleDB.js'
import { Signer } from './js/turtle/Signer.js'
// import { TurtleBranch } from './js/turtle/TurtleBranch.js'
import { TurtleDictionary } from './js/turtle/TurtleDictionary.js'
import { Workspace } from './js/turtle/Workspace.js'
// import { proxyWithRecaller } from './js/utils/proxyWithRecaller.js'
import { Recaller } from './js/utils/Recaller.js'

const cpk = document.baseURI.match(/(?<=\/)[0-9A-Za-z]{41,51}(?=\/)/)?.[0]
window.cpk = cpk
window.TurtleDictionary = TurtleDictionary
window.Signer = Signer
window.Workspace = Workspace
window.AS_REFS = AS_REFS

const url = `wss://${location.host}`
const recaller = new Recaller('web client')
const turtleDB = new TurtleDB('public/index.js', recaller)
window.turtleDB = turtleDB

// /** @type {Object.<string, TurtleBranch>} */
// const turtleRegistry = proxyWithRecaller({}, recaller)
// window.turtleRegistry = turtleRegistry
// // s3 overrides this
// const _getTurtleBranchByPublicKey = async (publicKey, name = publicKey, turtleBranch) => {
//   if (!turtleRegistry[publicKey]) {
//     turtleRegistry[publicKey] = turtleBranch ?? new TurtleBranch(name, recaller)
//   }
//   return turtleRegistry[publicKey]
// }
// window.getTurtleBranchByPublicKey = _getTurtleBranchByPublicKey

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
  console.log('-- creating new websocket and mux')
  const tbMux = new TurtleBranchMultiplexer('websocket', false)
  const addToTbMuxStep = async (next, publicKey, name, turtleBranchSuggestion) => {
    const turtleBranch = await next(publicKey, name, turtleBranchSuggestion)
    const updater = tbMux.getTurtleBranchUpdater(name, publicKey, turtleBranch, true)
    await updater.settle
    return updater.turtleBranch
  }
  turtleDB.addTurtleBranchStep(addToTbMuxStep)
  try {
    const ws = new WebSocket(url)
    window.tbMux = tbMux
    ws.binaryType = 'arraybuffer'
    const startOutgoingLoop = async () => {
      for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
        const branch = tbMux.getTurtleBranchUpdater(undefined, u8aTurtle.lookup('publicKey'))
        console.log('--', u8aTurtle.lookup('name'), 'web-client >>> outgoing', branch.outgoingBranch.lookup('uint8ArrayAddresses'))
        if (ws.readyState !== ws.OPEN) break
        ws.send(u8aTurtle.uint8Array)
      }
    }
    const startIncomingLoop = async () => {
      for await (const u8aTurtle of tbMux.incomingBranch.u8aTurtleGenerator()) {
        if (ws.readyState !== ws.OPEN) break
        const update = u8aTurtle.lookup()
        if (u8aTurtle.lookup('name') === 'test') {
          const branch = tbMux.getTurtleBranchUpdater(undefined, u8aTurtle.lookup('publicKey'))
          console.log('--', update.name, 'web-client <<< incomint', branch.incomingBranch.lookup('uint8ArrayAddresses'))
        }
        if (update.publicKey) turtleDB.getTurtleBranch(update.publicKey, update.name)
      }
    }
    ws.onopen = async () => {
      console.log('-- onopen')
      startOutgoingLoop() // don't await
      startIncomingLoop() // don't await

      const signer = new Signer('david', 'secret')
      const keys = await signer.makeKeysFor('test')
      // await new Promise(resolve => setTimeout(resolve, 3000))
      console.log('\n\n(warmup)')
      console.log('(warmup) about to getTurtleBranchByPublicKey', keys.publicKey)
      window.testBranch = await turtleDB.getTurtleBranch(keys.publicKey, 'test')
      console.log('(warmup) set window.testBranch')
      window.testWorkspace = new Workspace('test', signer, window.testBranch)
      console.log('(warmup) set window.testWorkspace')
      const result = await window.testWorkspace.commit({ random: Math.random() }, new Date())
      console.log('(warmup) commit result', result)
      console.log('\n\n(warmup) testBranch.index:', window.testBranch?.index)
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
  turtleDB.removeTurtleBranchStep(addToTbMuxStep)
  t = Math.min(t, 2 * 60 * 1000) // 2 minutes max (unjittered)
  t = t * (1 + Math.random()) // exponential backoff and some jitter
  console.log('waiting', t, 'ms')
  await new Promise(resolve => setTimeout(resolve, t))
}
