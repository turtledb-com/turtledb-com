/* global location, WebSocket */

import { TurtleBranchMultiplexer } from './js/turtle/connections/TurtleBranchMultiplexer.js'

console.log('asdf')
const cpk = document.baseURI.match(/(?<=\/)[0-9A-Za-z]{41,51}(?=\/)/)?.[0]
console.log(cpk)

const tbMux = new TurtleBranchMultiplexer('web-client')
const url = `wss://${location.host}`
const ws = new WebSocket(url)
ws.binaryType = 'arraybuffer'
ws.onopen = () => {
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
// ws.onclose = resolve
// ws.onerror = reject

window.cpk = cpk
window.tbMux = tbMux
