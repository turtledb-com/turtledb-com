import { fallbackCPK } from './constants.js'
import { h } from './display/h.js'
import { render } from './display/render.js'
import { peerRecaller, setPointerByPublicKey } from './net/Peer.js'
import { componentAtPath } from './utils/components.js'
import { connectPeer } from './utils/connectPeer.js'

const fallbackPointer = setPointerByPublicKey(fallbackCPK, peerRecaller)

const renderComponentScriptLinks = _element => {
  const fsRefs = fallbackPointer.lookupRefs(fallbackPointer.getCommitAddress(), 'value', 'fs')
  console.log('fsRefs', fsRefs)
  return Object.keys(fsRefs || {}).filter(relativePath => relativePath.match(/^components\//)).map(relativePath => {
    console.log(relativePath)
    return h`<script type="module" src="${relativePath}?address=${fsRefs[relativePath]}&amp;cpk=${fallbackCPK}"></script>`
  })
}

const serviceWorkerEnabled = connectPeer(peerRecaller)
const serviceWorkerError = _element => {
  if (!serviceWorkerEnabled) {
    return h`<p>service worker not enabled. a refresh might resolve this. otherwise try chrome. if it's really dead open a tab with "chrome://serviceworker-internals/", search for "turtledb.com" and hit the "stop" and "unregister" buttons, and reload this tab again.</p>`
  }
}

render(document, h`<html>
  <head>
    <title>turtledb-com = db * (squirtle/squirrel - com/db)</title>
    <link rel="icon" href="tinker.svg" />
    ${renderComponentScriptLinks}
  </head>
  ${serviceWorkerError}
  ${componentAtPath('components/main.js', fallbackCPK)}
</html>`, peerRecaller, 'main')
