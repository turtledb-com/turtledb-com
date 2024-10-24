import { Committer } from '../js/dataModel/Committer.js'
import { h } from '../js/display/h.js'
import { render } from '../js/display/render.js'
import { setPointerByPublicKey } from '../js/net/Peer.js'
import { componentAtPath, componentNameAtPath, deriveDefaults, useHash } from '../js/utils/components.js'
import { getPeer } from '../js/utils/connectPeer.js'

const { cpk: defaultCpk, recaller, elementName } = deriveDefaults(import.meta.url)
const { getCpk } = useHash(recaller)
window.customElements.define(elementName, class extends window.HTMLBodyElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
  }

  body = el => {
    const cpk = getCpk()
    if (!cpk) {
      return componentAtPath('components/home/welcome.js', defaultCpk)(el)
    }
    const pointer = setPointerByPublicKey(cpk)
    const localLength = pointer.layerIndex + 1
    const remoteLength = getPeer(recaller)?.remoteExports?.lookup?.()?.[cpk]?.want?.[0]?.[0]
    console.log({ localLength, remoteLength })
    if (remoteLength === undefined) {
      return h`
        <h1>Checking remote for existing turtle<h1>
      `
    }
    if (localLength < remoteLength) {
      return h`
        <h1>Downloading existing turtle... (${localLength} / ${remoteLength})</h1>
      `
    }
    if (!pointer.getCommitValue('value', 'fs', 'components/main/start.js')) {
      if (pointer instanceof Committer) {
        return h`
          <h1>no components/main/start.js</h1>
          ${componentAtPath('components/home/template-chooser.js', defaultCpk)}
        `
      } else {
        return h`
          <h1>no components/main/start.js</h1>
        `
      }
    }
    if (localLength !== remoteLength) {
      return h`
        <h1>Upoading existing turtle... (${localLength} / ${remoteLength})</h1>
      `
    }
    console.log('using cpk', cpk)
    return componentAtPath('components/main/start.js', cpk)(el)
  }

  connectedCallback () {
    render(this.shadowRoot, () => h`
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
      ${componentAtPath('components/login.js', defaultCpk)}
      ${this.body}
    `, recaller, elementName)
  }
}, { extends: 'body' })
