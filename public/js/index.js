import { fallbackCPK } from './constants.js'
import { h } from './display/h.js'
import { render } from './display/render.js'
import { getPublicKeys, peerRecaller, setPointerByPublicKey } from './net/Peer.js'
import { componentAtPath } from './utils/components.js'
import { connectPeer } from './utils/connectPeer.js'

const componentRegex = /^components\//
const renderComponentScriptLinks = _element => {
  const cpks = getPublicKeys()
  const scripts = []
  for (const cpk of cpks) {
    const pointer = setPointerByPublicKey(cpk)
    const fsRefs = pointer.lookupRefs(pointer.getCommitAddress(), 'value', 'fs')
    Object.keys(fsRefs || {}).filter(relativePath => relativePath.match(componentRegex)).forEach(relativePath => {
      scripts.push(h`<script type="module" src="${relativePath}?address=${fsRefs[relativePath]}&amp;cpk=${cpk}"></script>`)
    })
  }
  return scripts
}

const serviceWorkerEnabled = connectPeer(peerRecaller)
const serviceWorkerError = _element => {
  if (!serviceWorkerEnabled) {
    return h`<p>service worker not enabled. a refresh might resolve this. otherwise try chrome. if it's really dead open a tab with "chrome://serviceworker-internals/", search for "turtledb.com" and hit the "stop" and "unregister" buttons, and reload this tab again.</p>`
  }
}

render(document, h`<html style="height: 100%;">
  <head>
    <title>turtledb-com = db * (squirtle/squirrel - com/db)</title>
    <link rel="icon" href="tinker.svg" />
    ${renderComponentScriptLinks}
  </head>
  ${serviceWorkerError}
  ${componentAtPath('components/app.js', fallbackCPK, 'body')}
</html>`, peerRecaller, 'index.js')
