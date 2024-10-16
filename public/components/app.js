import { h } from '../js/display/h.js'
import { render } from '../js/display/render.js'
import { componentAtPath, deriveDefaults, useHash } from '../js/utils/components.js'

const { cpk, recaller, elementName } = deriveDefaults(import.meta.url)
const { getCpk } = useHash(recaller, cpk)
window.customElements.define(elementName, class extends window.HTMLBodyElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback () {
    render(this.shadowRoot, () => h`
      <style>
        :host {
          margin: 0;
          height: 100%
        }
      </style>
      ${componentAtPath('components/login.js', cpk)}
      ${componentAtPath('components/main/start.js', () => [getCpk, cpk])}
    `, recaller, elementName)
  }
}, { extends: 'body' })
