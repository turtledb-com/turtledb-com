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

// // s3 overrides this
// const _getTurtleBranchByPublicKey = async (publicKey, name = publicKey, turtleBranch) => {
//   if (!turtleRegistry[publicKey]) {
//     turtleRegistry[publicKey] = turtleBranch ?? new TurtleBranch(name, recaller)
//   }
//   return turtleRegistry[publicKey]
// }
// window.getTurtleBranchByPublicKey = _getTurtleBranchByPublicKey

const allServiceWorkers = new Set()
try {
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    '/service-worker.js',
    { type: 'module', scope: '/' }
  )
  console.log(' ^^^^^^^ register complete', serviceWorkerRegistration)
  serviceWorkerRegistration.addEventListener('updatefound', () => {
    console.log('service-worker update found')
  })
  try {
    console.log(' ^^^^^^^ serviceWorkerRegistration.update()')
    await serviceWorkerRegistration.update()
  } catch (err) {
    console.log(' ^^^^^^^ serviceWorkerRegistration.update() failed', err)
  }
  console.log(' ^^^^^^^ serviceWorkerRegistration.update() complete')
  const { serviceWorker } = navigator
  if (!serviceWorker || allServiceWorkers.has(serviceWorker)) throw new Error('no serviceWorker')
  const { active } = await serviceWorker.ready
  allServiceWorkers.add(serviceWorker)
  const tbMux = new TurtleBranchMultiplexer('serviceWorker')
  window.tbMux = tbMux
  const tbMuxBinding = async status => {
    // console.log('tbMuxBinding about to get next', { publicKey })
    const updater = await tbMux.getTurtleBranchUpdater(status.turtleBranch.name, status.publicKey, status.turtleBranch)
    // console.log('tbMuxBinding about to await settle', { updater })
    await updater.settle
    // console.log('tbMuxBinding', { publicKey })
  }
  turtleDB.bind(tbMuxBinding)
  serviceWorker.onmessage = event => {
    tbMux.incomingBranch.append(new Uint8Array(event.data))
  }
  serviceWorker.startMessages()
  for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
    active.postMessage(u8aTurtle.uint8Array.buffer)
  }
} catch (error) {
  console.error(error)
}

console.warn('unable to connect through service-worker, trying direct websocket connection')

let t = 100
let connectionCount = 0
while (true) {
  console.log(' ^^^^^^^ creating new websocket and mux')
  const tbMux = new TurtleBranchMultiplexer(`backup_websocket_#${connectionCount}`, false, turtleDB)
  for (const publicKey of turtleDB.getPublicKeys()) {
    await tbMux.getTurtleBranchUpdater(publicKey)
  }
  const tbMuxBinding = async status => {
    // console.log('tbMuxBinding about to get next', { publicKey })
    const updater = await tbMux.getTurtleBranchUpdater(status.turtleBranch.name, status.publicKey, status.turtleBranch)
    // console.log('tbMuxBinding about to await settle', { updater })
    await updater.settle
    // console.log('tbMuxBinding', { publicKey })
  }
  turtleDB.bind(tbMuxBinding)
  let connectionIndex
  try {
    connectionIndex = ++connectionCount
    const ws = new WebSocket(url)
    window.tbMux = tbMux
    ws.binaryType = 'arraybuffer'
    ws.onopen = async () => {
      console.log(' ^^^^^^^ onopen', { connectionIndex })
      ;(async () => {
        for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
          if (ws.readyState !== ws.OPEN) break
          ws.send(u8aTurtle.uint8Array)
        }
      })()
      t = 100
    }
    ws.onmessage = event => {
      if (event.data.length) tbMux.incomingBranch.append(new Uint8Array(event.data))
    }
    await new Promise((resolve, reject) => {
      ws.onclose = resolve
      ws.onerror = reject
    })
  } catch (error) {
    console.error(error)
  }
  tbMux.stop()
  delete window.tbMux
  turtleDB.unbind(tbMuxBinding)
  t = Math.min(t, 2 * 60 * 1000) // 2 minutes max (unjittered)
  t = t * (1 + Math.random()) // exponential backoff and some jitter
  console.log(` ^^^^^^^ waiting ${(t / 1000).toFixed(2)} ms`)
  await new Promise(resolve => setTimeout(resolve, t))
}
