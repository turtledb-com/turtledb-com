import { fallbackCPK } from './js/constants.js'
import { h } from './js/display/h.js'
import { render } from './js/display/render.js'
import { getPublicKeys, peerRecaller, getPointerByPublicKey } from './js/net/Peer.js'
import { componentAtPath } from './js/utils/components.js'
import { connectPeer } from './js/utils/connectPeer.js'

const componentRegex = /^components\//
const renderComponentScriptLinks = _element => {
  const cpks = getPublicKeys()
  const scripts = []
  for (const cpk of cpks) {
    const pointer = getPointerByPublicKey(cpk)
    const fsRefs = pointer.lookupRefs(pointer.getCommitAddress(), 'value', 'fs')
    Object.keys(fsRefs || {}).filter(relativePath => relativePath.match(componentRegex)).forEach(relativePath => {
      scripts.push(h`<script type="module" src="${relativePath}?address=${fsRefs[relativePath]}&amp;cpk=${cpk}"></script>`)
    })
  }
  return scripts
}

const serviceWorkerEnabled = connectPeer(peerRecaller)
const serviceWorkerError = () => {
  if (!serviceWorkerEnabled) {
    return h`<p>service worker not enabled. a refresh might resolve this. otherwise try chrome. if it's really dead open a tab with "chrome://serviceworker-internals/", search for "turtledb.com" and hit the "stop" and "unregister" buttons, and reload this tab again.</p>`
  }
}

render(document, h`<html style="height: 100%;">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>turtledb-com rendered content</title>
    <link rel="icon" href="tinker.svg" />
    ${renderComponentScriptLinks}
  </head>
  <${serviceWorkerError}/>
  <${componentAtPath('components/app.js', fallbackCPK, 'body')}/>
</html>`, peerRecaller, 'index.js')
