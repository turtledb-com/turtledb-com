import { fallbackCPK } from '../../js/constants.js'
import { Committer } from '../../js/dataModel/Committer.js'
import { h } from '../../js/display/h.js'
import { handle, showIfElse } from '../../js/display/helpers.js'
import { render } from '../../js/display/render.js'
import { getPointerByPublicKey, getPublicKeys } from '../../js/net/Peer.js'
import { componentAtPath, deriveDefaults, useHash } from '../../js/utils/components.js'

const { recaller, elementName, cpk } = deriveDefaults(import.meta.url)

const { getCpk, setCpk } = useHash(recaller)

function getIsLoggedIn () {
  const hash = getCpk() || cpk
  const pointer = getPointerByPublicKey(hash)
  return pointer instanceof Committer
}

const EXPANDED = Symbol('explorer header')
const COMPACT = Symbol('normal header')
const HIDDEN = Symbol('hidden header')

const classByState = {
  [EXPANDED]: 'expanded',
  [COMPACT]: 'compact',
  [HIDDEN]: 'hidden'
}

window.customElements.define(elementName, class extends window.HTMLElement {
  #state = COMPACT
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
  }

  handleSignin = () => async (username, hashwordPromise, turtlename) => {
    const hashword = await hashwordPromise
    console.log({ username, hashword, turtlename })
    const pointer = await window.peer.hashwordLogin(hashword, turtlename)
    const { compactPublicKey } = pointer
    setCpk(compactPublicKey)
  }

  form = componentAtPath('components/login/login-form.js', fallbackCPK)
  explorer = componentAtPath('components/turtle-explorer/turtle-explorer.js', fallbackCPK)

  listPeers = () => {
    const cpks = getPublicKeys()
    const liElements = cpks.map(cpk => {
      return h`<li><${this.explorer} cpk=${cpk} key="${this.key}.${cpk}"/></li>`
    })
    return h`<ul>
      ${liElements}
    </ul>`
  }

  get state () {
    recaller.reportKeyAccess(this, 'state', 'get', 'components/login.js')
    return this.#state
  }

  set state (state) {
    if (this.#state === state) return
    recaller.reportKeyMutation(this, 'state', 'set', 'components/login.js')
    this.#state = state
    this.classList.remove('expanded', 'compact', 'hidden')
    this.classList.add(classByState[state])
  }

  toggleExpanded = () => {
    if (this.state === COMPACT) this.state = EXPANDED
    else this.state = COMPACT
  }

  toggleHidden = () => {
    if (this.state === HIDDEN) this.state = COMPACT
    else this.state = HIDDEN
  }

  goHome = () => {
    setCpk()
  }

  connectedCallback () {
    recaller.watch('update login.js login status', () => {
      if (getIsLoggedIn()) this.classList.add('committer')
      else this.classList.remove('committer')
    })
    render(this.shadowRoot, () => h`
      <style>
        :host {
          z-index: 1000;
          position: sticky;
          top: 0;
          transition: all 200ms;
          --1-unit: 0.125rem;
          --2-units: calc(2 * var(--1-unit));
          --3-units: calc(3 * var(--1-unit));
          --6-units: calc(6 * var(--1-unit));
          --8-units: calc(8 * var(--1-unit));
          --16-units: calc(16 * var(--1-unit));
          --17-units: calc(17 * var(--1-unit));
          --39-units: calc(39 * var(--1-unit));
          --color-bg: MediumSeaGreen;
          --color-text: SeaGreen;
          --color-active-bg: Black;
          --input-border: var(--1-unit) solid var(--color-text);
          --input-margin-borderless: var(--2-units) var(--2-units);
        }
        :host(.hidden) {
          height: 0;
          overflow: hidden;
        }
        header {
          position: relative;
          color: var(--color-text);
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          margin: 0;
          padding: var(--3-units) min(100vw, calc(50vw - 45rem)) var(--1-unit) 0;
          border-bottom: var(--1-unit) solid var(--color-text);
          background: var(--color-bg);
          align-items: center;
          font-size: var(--8-units);
          box-sizing: border-box;
          transition: all 200ms;
        }
        :host(.hidden) header {
          bottom: 100%;
        }
        img {
          transition: all 200ms;
          height: var(--16-units);
          width: var(--16-units);
        }
        svg {
          transition: all 200ms;
          height: var(--16-units);
          width: var(--16-units);
        }
        button.hiddentoggle {
          position: fixed;
          top: var(--3-units);
          left: var(--3-units);
        }
        :host(.hidden) button.hiddentoggle {
        }
        button.homebutton {
          margin-left: var(--39-units);
        }
        .expandedtoggle {
          display: none;
        }
        :host(.committer) .expandedtoggle {
          display: block;
        }
        :host(.expanded) .expandedtoggle svg {
          transform: rotate(90deg);
        }
        ul {
          display: none;
          height: 0;
          overflow: hidden;
          transition: all 200ms;
        }
        :host(.expanded) ul {
          display: block;
          height: auto;
        }
        :host(.hidden) .hiddentoggle svg {
          transform: rotate(45deg);
        }
        button:hover svg {
          filter: grayscale(100%) contrast(300%);
        }
        button:hover img {
          filter: grayscale(100%) contrast(300%);
        }
        button {
          background-color: var(--color-bg);
          border: var(--input-border);
          border-radius: var(--6-units);
          box-sizing: content-box;
          font-size: var(--8-units);
          height: var(--17-units);
          margin: var(--input-margin-borderless);
          outline: none;
          padding: 0 var(--6-units);
          transition: all 200ms;
        }
        button:hover {
          background: var(--color-active-bg);
          border-color: var(--color-active-bg);
          color: var(--color-bg);
        }
        span {
          flex-grow: 1000;
          text-align: center;
        }
        ul {
          width: 100%;
        }
      </style>
      <header>
        <button class="hiddentoggle" onclick=${handle(this.toggleHidden)}>
          <svg viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg">
            <path stroke="SeaGreen" fill="MediumSpringGreen" stroke-width="3" d="M 0 -30 L 30 -60 L 60 -30 L 30 0 L 60 30 L 30 60 L 0 30 L -30 60 L -60 30 L -30 0 L -60 -30 L -30 -60 Z"/>
          </svg>
        </button>
        <button class="homebutton" onclick=${handle(this.goHome)}>
          <img src="../tinker.svg" alt="Tinker: your adorable mascot turtle (and a home button... what a scamp!)" />
        </button>
        <button class="expandedtoggle" onclick=${handle(this.toggleExpanded)}>
          <svg viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg">
            <path stroke="SeaGreen" fill="MediumSpringGreen" stroke-width="3" d="M 60 0 L -30 52 L -30 -52 Z"/>
          </svg>
        </button>
        ${showIfElse(
          () => getCpk() === fallbackCPK,
          h`
            <span>
              TURTLEDB.COM - believes in you!
            </span>
            <${this.form} handleSignin=${this.handleSignin} key="${this.key}.form"/>
          `,
          h`
            <span>
              ${() => getCpk() && getPointerByPublicKey(getCpk()).getCommitValue('name')}
            </span>
            <${this.form} handleSignin=${this.handleSignin} key="${this.key}.form"/>
          `
        )}
        ${this.listPeers}
      </header>
    `, recaller, elementName)
  }
})
