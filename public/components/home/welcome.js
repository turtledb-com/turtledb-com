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
          display: flex;
          flex-direction: column;
        }
      </style>
      <h1>
        Make something.
      </h1>
      <p>
        turtledb.com makes it easy.
        Try it, you'll like it!
      </p>

      <h2>
        You're supposed to make stuff.
      </h2>
      <p>
        The World Wide Web is made with you in mind.
        It's never been better than it is right now!
        CSS, HTML, and JavaScript are meant to be used by everyone.
        You can do it! We believe in you!
      </p>

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
