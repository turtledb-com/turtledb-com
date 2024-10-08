import { b64ToUi8 } from '../js/dataModel/Committer.js'
import { h } from '../js/display/h.js'
import { render } from '../js/display/render.js'
import { setPointerByPublicKey } from '../js/net/Peer.js'
import { buildElementName } from '../js/utils/components.js'

const scriptSrc = new URL(import.meta.url)
const address = scriptSrc.searchParams.get('address')
const cpk = scriptSrc.searchParams.get('cpk')

const pointer = setPointerByPublicKey(cpk)
const recaller = pointer.recaller

const elementName = buildElementName(scriptSrc.pathname, address, cpk)
console.log(elementName)
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
        <h1>Hello World Turtle!!</h1>
      </div>
    `, recaller, elementName)
  }
})
