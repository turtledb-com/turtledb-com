import { fallbackCPK } from './constants.js'
import { getCommitAddress } from './dataModel/Uint8ArrayLayerPointer.js'
import { h } from './display/h.js'
import { render } from './display/render.js'
import { peerRecaller, setPointerByPublicKey } from './net/Peer.js'
import { buildElementName } from './utils/components.js'
import { connectServiceWorker } from './utils/connectServiceWorker.js'

const fallbackPointer = setPointerByPublicKey(fallbackCPK, peerRecaller)

const renderCommit = _element => {
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
  return null
}

const renderComponentScriptLinks = _element => {
  const fsRefs = fallbackPointer.lookupRefs(fallbackPointer.getCommitAddress(), 'value', 'fs')
  console.log('fsRefs', fsRefs)
  return Object.keys(fsRefs || {}).filter(relativePath => relativePath.match(/^components\//)).map(relativePath => {
    console.log(relativePath)
    return h`<script type="module" src="${relativePath}?address=${fsRefs[relativePath]}&amp;cpk=${fallbackCPK}"></script>`
  })
}

const serviceWorkerEnabled = connectServiceWorker(peerRecaller)

const componentAtPath = (relativePath, cpk) => {
  return _element => {
    const turtle = setPointerByPublicKey(cpk)
    const fsRefs = turtle.lookupRefs(turtle.getCommitAddress(), 'value', 'fs')
    if (!fsRefs) {
      if (serviceWorkerEnabled) return 'loading...'
      return 'service worker not starting. try refreshing, switching browsers to chrome, or manually restarting the service worker.'
    }
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
    ${componentAtPath('components/start.js', fallbackCPK)}
  </body>
</html>`, peerRecaller, 'main')
