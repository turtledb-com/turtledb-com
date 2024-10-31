import { Committer } from '../../js/dataModel/Committer.js'
import { h } from '../../js/display/h.js'
import { handle } from '../../js/display/helpers.js'
import { render } from '../../js/display/render.js'
import { getPointerByPublicKey } from '../../js/net/Peer.js'
import { deriveDefaults, useHash } from '../../js/utils/components.js'

const { cpk: defaultCpk, recaller, elementName } = deriveDefaults(import.meta.url)
const { getCpk } = useHash(recaller)
console.log(elementName)
window.customElements.define(elementName, class extends window.HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
  }

  addBasicTemplate (_e, _el) {
    console.log('basic template')
    const committer = getPointerByPublicKey(getCpk(), recaller)
    if (!(committer instanceof Committer)) throw new Error('must be logged in to add template')
    let value = committer.getCommitValue()
    if (!value || typeof value !== 'object') value = {}
    if (!value.fs || typeof value.fs !== 'object') value.fs = {}
    const defaultPointer = getPointerByPublicKey(defaultCpk)
    value.fs['components/main/start.js'] = defaultPointer.getCommitValue('value', 'fs', 'components/templates/start.js')
    console.log(value)
    committer.commit('added basic template', value)
  }

  connectedCallback () {
    render(this.shadowRoot, () => h`
      <style>
      </style>
      <h1>Would you like to start with a template?</h1>
      <p>
        Selecting a template will add a file to this turtle. The file will be displayed here instead of this.
      </p>
      <h2>
      <ul>
        <li><button onclick=${handle(this.addBasicTemplate)}>Basic Template</button></li>
      </ul>
    `, recaller, elementName)
  }
})
