/* global location, WebSocket */
import { TurtleBranchMultiplexer } from '../turtle/connections/TurtleBranchMultiplexer.js'

  /**
 * @typedef {import('../turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
 * @typedef {import('./Recaller.js').Recaller} Recaller
 * @typedef {import('../turtle/connections/TurtleDB.js').TurtleBranchStatus} TurtleBranchStatus
 */

const allServiceWorkers = new Set()

/**
 * @param {TurtleDB} turtleDB
 * @param {(tbMux: TurtleBranchMultiplexer) => void} callback
 * @param {Recaller} [recaller=turtleDB.recaller]
 */
export async function webSocketMuxFactory (turtleDB, callback, recaller = turtleDB.recaller) {
  const url = `wss://${location.host}`
  try {
    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      '/service-worker.js',
      { type: 'module', scope: '/' }
    )
    console.log(' ^^^^^^^ register complete', serviceWorkerRegistration)
    serviceWorkerRegistration.addEventListener('updatefound', () => {
      console.log(' ^^^^^^^ service-worker update found')
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
    const tbMux = new TurtleBranchMultiplexer('serviceWorker', false, turtleDB, recaller)
    // callback(tbMux)
    const tbMuxBinding = async (/** @type {TurtleBranchStatus} */ status) => {
      console.log(' ^^^^^^^ tbMuxBinding about to get next')
      const updater = await tbMux.getTurtleBranchUpdater(status.turtleBranch.name, status.publicKey, status.turtleBranch)
      console.log(' ^^^^^^^ tbMuxBinding about to await settle', { updater })
      if(status.bindingInProgress !== tbMuxBinding) await updater.settle
      console.log(' ^^^^^^^ tbMuxBinding settled')
    }
    turtleDB.bind(tbMuxBinding)
    serviceWorker.onmessage = event => {
      tbMux.incomingBranch.append(new Uint8Array(event.data))
    }
    serviceWorker.startMessages()
    callback(tbMux)
    for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
      active.postMessage(u8aTurtle.uint8Array.buffer)
    }
  } catch (error) {
    console.error(error)
  }

  console.warn(' ^^^^^^^ unable to connect through service-worker, trying direct websocket connection')

  let t = 100
  let connectionCount = 0
  while (true) {
    console.log(' ^^^^^^^ creating new websocket and mux')
    const tbMux = new TurtleBranchMultiplexer(`backup_websocket_#${connectionCount}`, false, turtleDB)
    for (const publicKey of turtleDB.getPublicKeys()) {
      await tbMux.getTurtleBranchUpdater(publicKey)
    }
    const tbMuxBinding = async (/** @type {TurtleBranchStatus} */ status) => {
      // console.log(' ^^^^^^^ tbMuxBinding about to get next', { publicKey })
      const updater = await tbMux.getTurtleBranchUpdater(status.turtleBranch.name, status.publicKey, status.turtleBranch)
      // console.log(' ^^^^^^^ tbMuxBinding about to await settle', { updater })
      if(status.bindingInProgress !== tbMuxBinding) await updater.settle
      // console.log(' ^^^^^^^ tbMuxBinding', { publicKey })
    }
    turtleDB.bind(tbMuxBinding)
    let connectionIndex
    try {
      connectionIndex = ++connectionCount
      const ws = new WebSocket(url)
      callback(tbMux)
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
    callback() // delete old tbMux
    turtleDB.unbind(tbMuxBinding)
    t = Math.min(t, 2 * 60 * 1000) // 2 minutes max (unjittered)
    t = t * (1 + Math.random()) // exponential backoff and some jitter
    console.log(` ^^^^^^^ waiting ${(t / 1000).toFixed(2)} ms`)
    await new Promise(resolve => setTimeout(resolve, t))
  }
}
