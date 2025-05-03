import { collapseUint8Arrays } from '../dataModel/Uint8ArrayLayer.js'
import { Peer, unwatchPublicKeys, watchPublicKeys } from '../net/Peer.js'

const defaultVerbosity = 1

/**
 * @param {import('../utils/Recaller.js').Recaller} recaller
 * @param {(peer:Peer, receive:(uint8Array:Uint8Array)=>void, setSend:(send:(uint8Array:Uint8Array)=>void)=>void) => Promise} connectionCycle
 */
export async function newPeerPerCycle (prefix, recaller, connectionCycle, syncKeys = true, verbosity = defaultVerbosity) {
  let count = 0
  let retryDelay = 100
  while (true) {
    const name = `${prefix}#${count++}`
    const peer = new Peer(name, recaller)
    const runtime = await attachPeerToCycle(peer, connectionCycle, syncKeys, verbosity)
    if (runtime > 60 * 1000) {
      retryDelay = 100
    } else {
      retryDelay = Math.round(Math.min(60 * 1000, retryDelay * 1.4))
    }
    if (verbosity > 0) console.log(name, `connection ended. runtime: ${runtime * 0.001}s, retryDelay: ${retryDelay * 0.001}s`)
    await new Promise(resolve => setTimeout(resolve, retryDelay))
    if (verbosity > 0) console.log(name, 'restarting connection')
  }
}

export async function attachPeerToCycle (peer, connectionCycle, syncKeys = false, verbosity = defaultVerbosity) {
  const t0 = Date.now()
  const label = () => {
    if (typeof process === 'undefined') return `*** ${peer.name}`
    let { rss } = process.memoryUsage()
    const units = [' B', 'KB', 'MB', 'GB']
    let index = 0
    for (index = 0; index < units.length && rss > 1024; ++index) rss /= 1024
    rss = `${rss.toFixed(4).slice(0, 6)}${units[index]}`
    return `${rss} *** ${peer.name}`
  }
  let sendMissingLayers
  const keyWatcher = keys => {
    keys.forEach(compactPublicKey => {
      peer.addSourceObject(compactPublicKey, 'syncing all known keys')
    })
  }
  try {
    if (verbosity > 1) console.log(label(), 'starting')
    let remainder = new Uint8Array()
    await connectionCycle(
      prefixedUint8Array => {
        remainder = collapseUint8Arrays(remainder, prefixedUint8Array)
        let length = new Uint32Array(remainder.slice(0, 4).buffer)[0]
        while (length !== undefined && remainder.length >= 4 + length) {
          const uint8Array = remainder.slice(4, 4 + length)
          if (verbosity > 1) console.log(label(), peer.remoteExports.layerIndex + 1, 'incoming', peer.remoteExports.lookup())
          else if (verbosity > 0) console.log(`${label()}#${peer.remoteExports.layerIndex + 1}, ${uint8Array.length} bytes incoming`)
          peer.remoteExports.append(uint8Array)
          remainder = remainder.slice(4 + length)
          length = new Uint32Array(remainder.slice(0, 4).buffer)[0]
        }
      },
      send => {
        if (syncKeys) watchPublicKeys(keyWatcher)
        if (verbosity > 0) console.log(label(), 'onopen/send-available event')
        let sentLayers = -1
        sendMissingLayers = () => {
          for (let layerIndex = sentLayers + 1; layerIndex <= peer.layerIndex; ++layerIndex) {
            const { uint8Array } = peer.getLayerAtIndex(layerIndex)
            if (verbosity > 1) console.log(`${label()}, outgoing (layerIndex: ${layerIndex})`, peer.lookup())
            else if (verbosity > 0) console.log(`${label()}#${layerIndex} ${uint8Array.length} bytes outgoing`)
            send(collapseUint8Arrays(new Uint32Array([uint8Array.length]), uint8Array))
          }
          sentLayers = peer.layerIndex
        }
        peer.recaller.watch('sync with server', sendMissingLayers)
      },
      peer
    )
  } catch (error) {
    console.error('Error attaching peer to cycle:', error)
  }
  peer.cleanup()
  if (syncKeys) unwatchPublicKeys(keyWatcher)
  peer.recaller.unwatch(sendMissingLayers)
  const runtime = Date.now() - t0
  if (verbosity > 0) console.log(label(), `connection ended. runtime: ${runtime * 0.001}s`)
  return runtime
}
