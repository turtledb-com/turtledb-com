import { newPeerPerCycle } from './peerFactory.js'

const allServiceWorkers = new Set()
let alreadyWaiting = false
export function connectPeer (recaller) {
  if (alreadyWaiting) return
  alreadyWaiting = true
  try {
    const connectionCycle = (receive, setSend, peer) => new Promise((resolve, reject) => {
      navigator.serviceWorker.register(
        '/service-worker.js',
        { type: 'module', scope: '/' }
      ).then(serviceWorkerRegistration => {
        serviceWorkerRegistration.addEventListener('updatefound', () => {
          console.log('service-worker update found')
        })
        serviceWorkerRegistration.update().then(() => {
          const { serviceWorker } = navigator
          if (!serviceWorker || allServiceWorkers.has(serviceWorker)) return
          allServiceWorkers.add(serviceWorker)
          window.peer = peer
          console.log('#####   @type {Peer} window.peer')
          serviceWorker.onmessage = event => receive(new Uint8Array(event.data))
          serviceWorker.onmessageerror = event => console.log(peer.name, 'onmessageerror', event)
          serviceWorker.startMessages()
          serviceWorker.oncontrollerchange = resolve
          serviceWorker.onerror = reject
          serviceWorker.ready.then(({ active }) => {
            setSend(uint8Array => active.postMessage(uint8Array.buffer))
          })
        })
      })
    })
    newPeerPerCycle('[main.js to service-worker]', recaller, connectionCycle, true)
    return true
  } catch (error) {
    console.error(error)
    console.error('###########################################################################################')
    console.error('##    COULDN\'T START SERVICE WORKER, trying to connect directly (console should work)    ##')
    console.error('###########################################################################################')
    const url = `wss://${window.location.host}`
    const connectionCycle = (receive, setSend, peer) => new Promise((resolve, reject) => {
      window.peer = peer
      console.log('#####   @type {Peer} window.peer')
      const ws = new window.WebSocket(url)
      ws.binaryType = 'arraybuffer'
      ws.onopen = () => {
        setSend(uint8Array => ws.send(uint8Array.buffer))
      }
      ws.onmessage = event => {
        receive(new Uint8Array(event.data))
      }
      ws.onclose = resolve
      ws.onerror = reject
    })
    newPeerPerCycle('[main.js to WebSocket]', recaller, connectionCycle)
    return false
  }
}
