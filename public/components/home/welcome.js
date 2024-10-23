import { h } from '../../js/display/h.js'
import { render } from '../../js/display/render.js'
import { deriveDefaults } from '../../js/utils/components.js'

const { recaller, elementName } = deriveDefaults(import.meta.url)
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
          padding: 1em;
        }
      </style>
      <h1>Your anything.</h1>
      <p>
        The internet is CSS, HTML, JavaScript, and data. 
      </p>
      <p>
        CSS, HTML, and JavaScript are data. 
      </p>
      <h2>
      <ul>
        <li><s>starting templates</s> (enough to <i>technically</i> demo)</li>
        <li>better starting templates (in progress)</li>
        <li>clean up memory leaks</li>
        <li>switch to proxies to enable partial rerenders</li>
        <li>spend a few days trying to make it pretty</li>
      </ul>
    `, recaller, elementName)
  }
})
