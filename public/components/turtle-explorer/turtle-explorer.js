import { h } from '../../js/display/h.js'
import { handle } from '../../js/display/helpers.js'
import { render } from '../../js/display/render.js'
import { cog, equilateral } from '../../js/display/shapes.js'
import { getPointerByPublicKey } from '../../js/net/Peer.js'
import { deriveDefaults } from '../../js/utils/components.js'

const { recaller, elementName } = deriveDefaults(import.meta.url)

window.customElements.define(elementName, class extends window.HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
  }

  #showData = false
  get showData () {
    recaller.reportKeyAccess(this, 'showData', 'get', elementName)
    return this.#showData
  }

  set showData (showData) {
    recaller.reportKeyMutation(this, 'showData', 'set', elementName)
    if (showData) {
      this.classList.add('show-data')
    } else {
      this.classList.remove('show-data')
    }
    this.#showData = showData
  }

  toggleData = () => {
    this.showData = !this.showData
  }

  #showMeta = false
  get showMeta () {
    recaller.reportKeyAccess(this, 'showMeta', 'get', elementName)
    return this.#showMeta
  }

  set showMeta (showMeta) {
    recaller.reportKeyMutation(this, 'showMeta', 'set', elementName)
    if (showMeta) {
      this.classList.add('show-meta')
    } else {
      this.classList.remove('show-meta')
    }
    this.#showMeta = showMeta
  }

  toggleMeta = () => {
    this.showMeta = !this.showMeta
  }

  connectedCallback () {
    render(this.shadowRoot, this.content, recaller, elementName)
  }

  name = () => {
    return getPointerByPublicKey(this.cpk).getCommitValue('name') ?? h`<i>no commits</i>`
  }

  commitSelector = () => {
    return h`
      <button onclick=${handle(this.toggleMeta)}>
        <${cog} teeth=5 class="expanded-meta"/>
      </button>
      <button onclick=${handle(this.toggleData)}>
        <${equilateral} class="expanded-data"/>
      </button>
    `
  }

  content = () => h`
    <style>
      svg {
        transition: all 200ms;
      }
      :host(.show-meta) .expanded-meta {
        transform: rotate(90deg);
      }
      .expanded-data {
        transform: translate(0, 0.1em) rotate(90deg);
      }
      :host(.show-data) .expanded-data {
        transform: rotate(180deg);
      }
    </style>
    <a href="#${this.cpk}">${this.name}</a>
    ${this.commitSelector}
  `
})
