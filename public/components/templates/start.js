import { h } from '../../js/display/h.js'
import { render } from '../../js/display/render.js'
import { getPointerByPublicKey } from '../../js/net/Peer.js'
import { buildElementName } from '../../js/utils/components.js'
const scriptSrc = new URL(import.meta.url)
const address = scriptSrc.searchParams.get('address')
const cpk = scriptSrc.searchParams.get('cpk')
const pointer = getPointerByPublicKey(cpk)
const recaller = pointer.recaller
const elementName = buildElementName(scriptSrc.pathname, address, cpk)
console.log(scriptSrc.pathname, address, cpk)
const renderCommit = _element => {
  if (pointer.length) {
    const commitAddress = pointer.getAddress()
    if (commitAddress) {
      const commit = pointer.lookup(commitAddress)
      return JSON.stringify({
        cpk: commit?.compactPublicKey,
        message: commit?.message,
        name: commit?.name,
        ts: commit?.ts?.toString?.(),
        totalBytes: pointer.length,
        layerBytes: pointer.length - (pointer.uint8ArrayLayer?.parent?.length ?? 0),
        layerIndex: pointer.layerIndex
      })
    }
  }
  return null
}
window.customElements.define(elementName, class extends window.HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback () {
    render(this.shadowRoot, () => h`
      <style>
        :host {
          display: flex;
          flex-direction: column;
        }
        div {
          margin: 16px 8px;
          display: inline-block;
          border: 1px solid black;
          border-radius: 8px;
        }
        h1 {
          margin: 0;
          padding: 16px 8px;
          border-bottom: 1px solid lightgray;
        }
      </style>
      <div>
        ${renderCommit}
        <h1>Hello World Turtle!</h1>
      </div>
    `, recaller, elementName)
  }
})
