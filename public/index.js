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
let connectionCount = 0
while (true) {
  console.log('-- creating new websocket and mux')
  const tbMux = new TurtleBranchMultiplexer(`websocket#${connectionCount}`, false, turtleDB)
  for (const publicKey of turtleDB.getPublicKeys()) {
    await tbMux.getTurtleBranchUpdater(publicKey)
  }
  const addToTBMuxStep = async status => {
    // console.log('addToTBMuxStep about to get next', { publicKey })
    const updater = await tbMux.getTurtleBranchUpdater(status.turtleBranch.name, status.publicKey, status.turtleBranch)
    // console.log('addToTBMuxStep about to await settle', { updater })
    await updater.settle
    // console.log('addToTBMuxStep', { publicKey })
  }
  turtleDB.bind(addToTBMuxStep)
  let _connectionCount
  try {
    const ws = new WebSocket(url)
    window.tbMux = tbMux
    ws.binaryType = 'arraybuffer'
    const startOutgoingLoop = async () => {
      // console.log('startOutgoingLoop', { _connectionCount })
      for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
        // console.log('outgoing', ws.readyState, ws.OPEN, { _connectionCount })
        if (ws.readyState !== ws.OPEN) break
        const publicKey = u8aTurtle.lookup('publicKey')
        // console.log('\n\n -------')
        if (!tbMux.publicKeys.includes(publicKey)) {
          turtleDB.summonBoundTurtleBranch(publicKey, u8aTurtle.lookup('name'))
        }
        await tbMux.getTurtleBranchUpdater(undefined, publicKey) //
        // console.log('--', JSON.stringify(u8aTurtle.lookup('name')), 'web-client >>> outgoing', updater.outgoingBranch.lookup('uint8ArrayAddresses'))
        // console.log(ws.readyState)
        // console.log(ws.readyState !== ws.OPEN)
        // if (ws.readyState !== ws.OPEN) break
        ws.send(u8aTurtle.uint8Array)
      }
    }
    const startIncomingLoop = async () => {
      // console.log('startIncomingLoop', { _connectionCount })
      for await (const u8aTurtle of tbMux.incomingBranch.u8aTurtleGenerator()) {
        // console.log('incoming', ws.readyState, ws.OPEN, { _connectionCount })
        if (ws.readyState !== ws.OPEN) break
        // if (ws.readyState !== ws.OPEN) break
        const update = u8aTurtle.lookup()
        if (u8aTurtle.lookup('name') === 'test') {
          await tbMux.getTurtleBranchUpdater(u8aTurtle.lookup('name'), u8aTurtle.lookup('publicKey'))
          // console.log('--', JSON.stringify(update.name), 'web-client <<< incoming', updater.incomingBranch.lookup('uint8ArrayAddresses'))
        }
        if (update.publicKey) turtleDB.summonBoundTurtleBranch(update.publicKey, update.name)
      }
    }
    ws.onopen = async () => {
      _connectionCount = ++connectionCount
      console.log('-- onopen', { _connectionCount })
      startOutgoingLoop() // don't await
      startIncomingLoop() // don't await
      t = 100

      const signer = new Signer('david', 'secret')
      const keys = await signer.makeKeysFor('test')
      console.log({ keys })
      // await new Promise(resolve => setTimeout(resolve, 3000))
      console.log('\n\n(warmup)')
      console.log('(warmup) about to getTurtleBranchByPublicKey', keys.publicKey)
      window.testBranch = await turtleDB.summonBoundTurtleBranch(keys.publicKey, 'test')
      console.log('(warmup) set window.testBranch')
      window.testWorkspace = new Workspace('test', signer, window.testBranch)
      console.log('(warmup) set window.testWorkspace')
      const result = await window.testWorkspace.commit({ random: Math.random() }, new Date())
      console.log('(warmup) commit result', result)
      console.log('\n\n(warmup) testBranch.index:', window.testBranch?.index)
    }
    ws.onmessage = event => {
      // console.log(event)
      tbMux.incomingBranch.append(new Uint8Array(event.data))
    }
    await new Promise((resolve, reject) => {
      ws.onclose = resolve
      ws.onerror = reject
    })
    // console.log('-- onclose/onerror', { _connectionCount })
  } catch (error) {
    console.error(error)
  }
  // console.log('-- exited try')
  delete window.tbMux
  turtleDB.unbind(addToTBMuxStep)
  t = Math.min(t, 20 * 1000) // 2 minutes max (unjittered)
  t = t * (1 + Math.random()) // exponential backoff and some jitter
  console.log('waiting', t, 'ms')
  await new Promise(resolve => setTimeout(resolve, t))
}
