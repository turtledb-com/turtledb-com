/* global location, WebSocket */

import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'

console.log('asdf')
const cpk = document.baseURI.match(/(?<=\/)[0-9A-Za-z]{41,51}(?=\/)/)?.[0]
console.log(cpk)

await new Promise((resolve) => setTimeout(resolve, 500))
console.log(cpk)

const url = `wss://${location.host}`

let t = 100
while (true) {
  try {
    console.log('creating new websocket and mux')
    const tbMux = new TurtleBranchMultiplexer('web-client')
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
