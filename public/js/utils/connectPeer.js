import { newPeerPerCycle } from './peerFactory.js'

const allServiceWorkers = new Set()
let alreadyWaiting = false
const peerByRecaller = new Map()
/**
 * @param {import('../utils/Recaller.js').Recaller} recaller
 * @returns {import('../net/Peer.js').Peer}
 */
export function getPeer (recaller) {
  recaller.reportKeyAccess(peerByRecaller, 'peer', 'getPeer', 'connectPeer.js')
  return peerByRecaller.get(recaller)
}
function setPeer (recaller, peer) {
  window.peer = peer
  console.log('#####   @type {Peer} window.peer')
  peerByRecaller.set(recaller, peer)
  recaller.reportKeyMutation(peerByRecaller, 'peer', 'setPeer', 'connectPeer.js')
}
export async function connectPeer (recaller) {
  if (alreadyWaiting) return
  alreadyWaiting = true
  try {
    const connectionCycle = async (receive, setSend, peer) => {
      try {
        const serviceWorkerRegistration = await navigator.serviceWorker.register(
          '/service-worker.js',
          { type: 'module', scope: '/' }
        )
        console.log('register complete', serviceWorkerRegistration)
        serviceWorkerRegistration.addEventListener('updatefound', () => {
          console.log('service-worker update found')
        })
        console.log('added updatefound listener')
        try {
          console.log(' ^^^^^^^ serviceWorkerRegistration.update()')
          await serviceWorkerRegistration.update()
        } catch (err) {
          console.log(' ^^^^^^^ serviceWorkerRegistration.update() failed', err)
        }
        console.log(' ^^^^^^^ serviceWorkerRegistration.update() complete')
        const { serviceWorker } = navigator
        if (!serviceWorker || allServiceWorkers.has(serviceWorker)) return
        const { active } = await serviceWorker.ready
        allServiceWorkers.add(serviceWorker)
        setPeer(recaller, peer)
        serviceWorker.onmessage = event => receive(new Uint8Array(event.data))
        serviceWorker.onmessageerror = event => console.log(peer.name, 'onmessageerror', event)
        serviceWorker.startMessages()
        setSend(uint8Array => active.postMessage(uint8Array.buffer))
        return new Promise((resolve, reject) => {
          serviceWorker.oncontrollerchange = resolve
          serviceWorker.onerror = reject
        })
      } catch (error) {
        console.error(error)
      }
    }
    await newPeerPerCycle('[main.js to service-worker]', recaller, connectionCycle, true)
  } catch (error) {
    console.error(error)
    console.error('###########################################################################################')
    console.error('##    COULDN\'T START SERVICE WORKER, trying to connect directly (console should work)    ##')
    console.error('###########################################################################################')
    const url = `wss://${window.location.host}`
    const connectionCycle = (receive, setSend, peer) => new Promise((resolve, reject) => {
      setPeer(recaller, peer)
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
