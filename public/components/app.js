import { fallbackCPK } from '../js/constants.js'
import { Committer } from '../js/dataModel/Committer.js'
import { h } from '../js/display/h.js'
import { render } from '../js/display/render.js'
import { getPointerByPublicKey } from '../js/net/Peer.js'
import { componentAtPath, deriveDefaults, useHash } from '../js/utils/components.js'
import { getPeer } from '../js/utils/connectPeer.js'

const { cpk: defaultCpk, recaller, elementName } = deriveDefaults(import.meta.url)
const { getCpk } = useHash(recaller)
window.customElements.define(elementName, class extends window.HTMLBodyElement {
  #lastCpk
  #bodyForCpk
  constructor () {
    super()
    console.log('app.js constructor')
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback () {
    console.log('app.js connectedCallback')
    this.f = render(this.shadowRoot, this.content, recaller, elementName)
  }

  disconnectedCallback () {
    console.log('app.js disconnectedCallback')
    recaller.unwatch(this.f)
  }

  login = componentAtPath('components/login/login.js', defaultCpk)
  templateChooser = componentAtPath('components/home/template-chooser.js', defaultCpk)

  content = () => h`
    <style>
      :host {
        margin: 0;
        height: 100%;
        font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";
        display: flex;
        flex-direction: column;
      }
      div {
        flex-grow: 1;
      }
    </style>
    <${this.login} key="login"/>
    <${this.body} key="body"/>
  `

  body = () => {
    const cpk = getCpk()
    if (!cpk || cpk === fallbackCPK) {
      return componentAtPath('components/home/welcome.js', defaultCpk)()
    }
    const pointer = getPointerByPublicKey(cpk)
    const localLength = pointer.layerIndex + 1
    const remoteLength = getPeer(recaller)?.remoteExports?.lookup?.()?.[cpk]?.want?.[0]?.[0]
    console.log({ localLength, remoteLength })
    if (remoteLength === undefined) {
      return h`<h1>Checking remote for existing turtle<h1>`
    }
    if (localLength < remoteLength) {
      return h`<h1>Downloading existing turtle... (${localLength} / ${remoteLength})</h1>`
    }
    if (!pointer.getCommitValue('value', 'fs', 'components/main/start.js')) {
      if (pointer instanceof Committer) {
        return h`
          <h1>no components/main/start.js</h1>
          <${this.templateChooser} key="templateChooser"/>
        `
      } else {
        return h`<h1>no components/main/start.js</h1>`
      }
    }
    if (localLength !== remoteLength) {
      return h`<h1>Upoading existing turtle... (${localLength} / ${remoteLength})</h1>`
    }
    if (this.#lastCpk !== cpk) {
      this.#lastCpk = cpk
      this.#bodyForCpk = componentAtPath('components/main/start.js', cpk)()
    }
    return this.#bodyForCpk
  }
}, { extends: 'body' })
