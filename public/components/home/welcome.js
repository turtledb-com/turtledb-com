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
      </style>
      <h1>Welcome to your internet.</h1>
      <p>
        Lorem ipsum 
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
