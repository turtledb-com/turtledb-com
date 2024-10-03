/* global location WebSocket */

import { fallbackCPK } from './constants.js'
import { Committer } from './dataModel/Committer.js'
import { getCommitAddress } from './dataModel/Uint8ArrayLayerPointer.js'
import { h } from './display/h.js'
import { render } from './display/render.js'
import { setPointerByPublicKey } from './net/Peer.js'
import { Recaller } from './utils/Recaller.js'
import { buildElementName } from './utils/components.js'
import { hashNameAndPassword } from './utils/crypto.js'
import { newPeerPerCycle } from './utils/peerFactory.js'

const recaller = new Recaller('main.js')

window.login = async (username, password, turtlename = 'home') => {
  const hashword = await hashNameAndPassword(username, password)
  const privateKey = await hashNameAndPassword(turtlename, hashword)
  const committer = new Committer(turtlename, privateKey, recaller)
  const compactPublicKey = committer.compactPublicKey
  const originalCommitter = setPointerByPublicKey(compactPublicKey, recaller, committer)
  window.peer.addSourceObject(
    compactPublicKey,
    `console login ${username}/${turtlename}/${compactPublicKey}`
  )
  return originalCommitter
}

const fallbackPointer = setPointerByPublicKey(fallbackCPK, recaller)

recaller.watch('watch fallbackPointer', () => {
  const commitAddress = getCommitAddress(fallbackPointer)
  const layerIndex = fallbackPointer.layerIndex
  const totalLength = fallbackPointer.length
  const length = fallbackPointer.uint8ArrayLayer?.uint8Array?.length
  console.log({ commitAddress, layerIndex, totalLength, length })
})

const renderCommit = el => {
  if (fallbackPointer.length) {
    const commitAddress = getCommitAddress(fallbackPointer)
    if (commitAddress) {
      const commit = fallbackPointer.lookup(commitAddress)
      console.log(commit)

      return JSON.stringify({
        cpk: commit?.compactPublicKey,
        message: commit?.message,
        name: commit?.name,
        ts: commit?.ts?.toString?.(),
        totalBytes: fallbackPointer.length,
        layerBytes: fallbackPointer.length - fallbackPointer.uint8ArrayLayer?.parent?.length,
        layerIndex: fallbackPointer.layerIndex
      })
    }
  }
  return 'loading'
}

const renderComponentScriptLinks = el => {
  const fsRefs = fallbackPointer.lookupRefs(fallbackPointer.getCommitAddress(), 'value', 'fs')
  console.log('fsRefs', fsRefs)
  return Object.keys(fsRefs || {}).filter(relativePath => relativePath.match(/components/)).map(relativePath => {
    console.log(relativePath)
    return h`<script type="module" src="${relativePath}?address=${fsRefs[relativePath]}&amp;cpk=${fallbackCPK}"></script>`
  })
}

const pathToName = (relativePath, cpk) => {
  return el => {
    const turtle = setPointerByPublicKey(cpk)
    const fsRefs = turtle.lookupRefs(turtle.getCommitAddress(), 'value', 'fs')
    if (!fsRefs) return 'still-loading'
    const address = fsRefs[relativePath]
    const elementName = buildElementName(relativePath, address, cpk)
    return h`<${elementName} />`
  }
}

render(document, h`<html>
  <head>
    <title>turtle = squirtle / squirrel</title>
    <link rel="icon" href="tinker.svg" />
    ${renderComponentScriptLinks}
  </head>
  <body style="margin: 0;">
    ${renderCommit}
    ${pathToName('components/start.js', fallbackCPK)}
  </body>
</html>`, recaller, 'main')

const allServiceWorkers = new Set()
let alreadyWaiting = false
async function connectServiceWorker () {
  if (alreadyWaiting) return
  alreadyWaiting = true
  try {
    const connectionCycle = (receive, setSend, peer) => new Promise((resolve, reject) => {
      navigator.serviceWorker.register(
        '/service-worker.js',
        { type: 'module', scope: '/' }
      ).then(serviceWorkerRegistration => {
        serviceWorkerRegistration.update().then(() => {
          const { serviceWorker } = navigator
          if (!serviceWorker || allServiceWorkers.has(serviceWorker)) return
          allServiceWorkers.add(serviceWorker)
          window.peer = peer
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
  } catch (error) {
    console.error(error)
    console.error('###########################################################################################')
    console.error('##    COULDN\'T START SERVICE WORKER, trying to connect directly (console should work)    ##')
    console.error('###########################################################################################')
    const url = `wss://${location.host}`
    const connectionCycle = (receive, setSend, peer) => new Promise((resolve, reject) => {
      window.peer = peer
      const ws = new WebSocket(url)
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
  }
}
connectServiceWorker()
/*
serviceWorkerRegistration.addEventListener('updatefound', () => {
  connectServiceWorker(serviceWorkerRegistration)
})
*/
