import { fallbackCPK } from '../../js/constants.js'
import { KIND, getCodecs } from '../../js/dataModel/CODECS.js'
import { h } from '../../js/display/h.js'
import { handle, showIfElse } from '../../js/display/helpers.js'
import { render } from '../../js/display/render.js'
import { cog, equilateral } from '../../js/display/shapes.js'
import { getPointerByPublicKey } from '../../js/net/Peer.js'
import { componentAtPath, deriveDefaults } from '../../js/utils/components.js'

const { recaller, elementName } = deriveDefaults(import.meta.url)

let watchedCount = 0

window.customElements.define(elementName, class extends window.HTMLElement {
  #f
  constructor () {
    super()
    console.log('turtle-explorer.js constructor')
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback () {
    this.#f = render(this.shadowRoot, this.content, recaller, elementName)
    ++watchedCount
    console.log('turtle-explorer.js connectedCallback', watchedCount)
  }

  disconnectedCallback () {
    recaller.unwatch(this.#f)
    --watchedCount
    console.log('turtle-explorer.js disconnectedCallback', watchedCount)
  }

  #showValue = false
  get showValue () {
    recaller.reportKeyAccess(this, 'showValue', 'get', elementName)
    return this.#showValue
  }

  set showValue (showValue) {
    recaller.reportKeyMutation(this, 'showValue', 'set', elementName)
    if (showValue) {
      this.classList.add('show-value')
    } else {
      this.classList.remove('show-value')
    }
    this.#showValue = showValue
  }

  toggleValue = () => {
    this.showValue = !this.showValue
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

  name = () => {
    return getPointerByPublicKey(this.cpk).getCommitValue('name') ?? h`<i>no commits</i>`
  }

  object = componentAtPath('components/turtle-explorer/object.js', fallbackCPK)

  commitSelector = () => {
    const pointer = getPointerByPublicKey(this.cpk)
    const commit = pointer.getCommit(undefined, getCodecs(KIND.REFS_TOP)) ?? {}
    console.log(commit)
    const meta = Object.fromEntries(Object.entries(commit).filter(([key]) => key !== 'value'))
    const value = pointer.lookupRefs(pointer.getCommitAddress(), 'value')
    return h`
      <button onclick=${handle(this.toggleMeta)}>
        <${cog} teeth=5 class="expanded-meta"/>
      </button>
      <button onclick=${handle(this.toggleValue)}>
        <${equilateral} class="expanded-value"/>
      </button>
      ${showIfElse(
      () => this.showMeta,
      h`<${this.object} ${{ pointer, value: meta, key: `${this.key}.meta` }}/>`
    )}
      ${showIfElse(
      () => this.showValue,
      h`<${this.object} ${{ pointer, value, key: `${this.key}.value` }}/>`
    )}
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
      .expanded-value {
        transform: translate(0, 0.1em) rotate(90deg);
      }
      :host(.show-value) .expanded-value {
        transform: rotate(180deg);
      }
    </style>
    <a href="#${this.cpk}">${this.name}</a>
    ${this.commitSelector}
  `
})
