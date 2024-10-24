import { Committer } from '../js/dataModel/Committer.js'
import { h } from '../js/display/h.js'
import { handle, showIfElse } from '../js/display/helpers.js'
import { render } from '../js/display/render.js'
import { setPointerByPublicKey } from '../js/net/Peer.js'
import { deriveDefaults, useHash } from '../js/utils/components.js'

const { recaller, elementName, cpk } = deriveDefaults(import.meta.url)

const { getCpk, setCpk } = useHash(recaller)

function getIsLoggedIn () {
  const hash = getCpk() || cpk
  const pointer = setPointerByPublicKey(hash)
  console.log('getIsLoggedIn', pointer instanceof Committer)
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

  get state () {
    recaller.reportKeyAccess(this, 'state', 'get', 'components/login.js')
    return this.#state
  }

  set state (state) {
    if (this.#state === state) return
    recaller.reportKeyMutation(this, 'state', 'set', 'components/login.js')
    this.#state = state
    this.classList = [classByState[state]]
  }

  signIn = (e, el) => {
    e.preventDefault()
    const formData = new FormData(el)
    el.reset()
    console.log(el, e, formData)
    const username = formData.get('username')
    const password = formData.get('password')
    const turtlename = formData.get('turtlename') || 'home'
    window.peer.login(username, password, turtlename).then(pointer => {
      const { compactPublicKey } = pointer
      setCpk(compactPublicKey)
    })
  }

  toggleExpanded = (e, el) => {
    console.log(this, e, el)
    if (this.state === COMPACT) this.state = EXPANDED
    else this.state = COMPACT
  }

  toggleHidden = (e, el) => {
    console.log(this, e, el)
    if (this.state === HIDDEN) this.state = COMPACT
    else this.state = HIDDEN
  }

  connectedCallback () {
    const header = h`
      <header>
        <button class="hiddentoggle" onclick=${handle(this.toggleHidden)}>
          <svg viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg">
            <path stroke="SeaGreen" fill="MediumSpringGreen" stroke-width="3" d="M 0 -30 L 30 -60 L 60 -30 L 30 0 L 60 30 L 30 60 L 0 30 L -30 60 L -60 30 L -30 0 L -60 -30 L -30 -60 Z"/>
          </svg>
        </button>
        <button class="expandedtoggle" onclick=${handle(this.toggleExpanded)}>
          <svg viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg">
            <path stroke="SeaGreen" fill="MediumSpringGreen" stroke-width="3" d="M 0 60 L 52 -30 L -52 -30 Z"/>
          </svg>
        </button>
        <button>
          <img src="../tinker.svg" alt="Tinker: your adorable mascot turtle (and a button)... what a scamp!" />
        </button>
        <span>
          TURTLEDB.COM - believes in you!
        </span>
        <form onsubmit=${handle(this.signIn)}>
          <div>
            <input type="text" id="username" name="username" placeholder="" autocomplete="off" required />
            <label for="username">username</label>
          </div>

          <div>
            <input type="password" id="pass" name="password" placeholder="" autocomplete="off" required />
            <label for="pass">password</label>
          </div>

          <div>
            <input type="text" id="turtlename" name="turtlename" placeholder="home" autocomplete="off" />
            <label for="turtlename">turtlename</label>
          </div>

          <input type="submit" value="Load/Create Turtle" />
        </form>
      </header>
    `
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
          --4-units: calc(4 * var(--1-unit));
          --5-units: calc(5 * var(--1-unit));
          --6-units: calc(6 * var(--1-unit));
          --8-units: calc(8 * var(--1-unit));
          --12-units: calc(12 * var(--1-unit));
          --16-units: calc(16 * var(--1-unit));
          --17-units: calc(17 * var(--1-unit));
          --39-units: calc(39 * var(--1-unit));
          --100-units: calc(100 * var(--1-unit));
          --color-bg: MediumSeaGreen;
          --color-text: SeaGreen;
          --color-active-bg: Black;
          --color-active-text: HoneyDew;
          --color-highlight: MediumSpringGreen;
          --input-border: var(--1-unit) solid var(--color-text);
          --input-margin-borderless: var(--2-units) var(--2-units);
          --input-margin: var(--1-unit) var(--2-units);
        }
        :host(.hidden) {
          height: 0;
          overflow: hidden;
        }
        :host(.expanded) {
          height: 100%;
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

        form {
          color: var(--color-text);
          margin: 0;
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: end;
          flex-grow: 1;
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
        button.expandedtoggle{
          margin-left: var(--39-units);
        }
        :host(.expanded) .expandedtoggle svg {
          transform: rotate(60deg);
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

        div {
          position: relative;
          margin: var(--input-margin);
        }
        label {
          font-size: var(--8-units);
          position: absolute;
          left: var(--4-units);
          top: var(--4-units);
          background: var(--color-bg);
          transition: transform 200ms;
          pointer-events: none;
          transform-origin: left;
          padding: 0 var(--3-units);
          border-radius: var(--6-units);
          border: var(--1-unit) solid var(--color-bg);
        }
        input:hover + label {
          background: var(--color-active-text);
          border-color: var(--color-active-text);
          color: var(--color-active-bg);
        }
        input:focus + label {
          border-color: var(--color-text);
          color: var(--color-text);
          background: var(--color-active-text);
          transform: translateY(calc(-50% - var(--6-units))) scale(.8);
        }
        input:focus:hover + label {
          background: var(--color-active-text);
          border-color: var(--color-active-bg);
          color: var(--color-active-bg);
        }
        input:not(:placeholder-shown) + label {
          border-color: var(--color-text);
          color: var(--color-text);
          transform: translateY(calc(-50% - var(--6-units))) scale(.8);
        }
        input:not(:placeholder-shown):hover + label {
          border-color: var(--color-active-bg);
          color: var(--color-active-bg);
        }
        input {
          border-radius: var(--6-units);
          height: var(--6-units);
          padding: var(--6-units);
          background-color: var(--color-bg);
          border: var(--input-border);
          outline: none;
          box-sizing: content-box;
          font-size: var(--8-units);
          width: var(--100-units);
        }
        input:hover {
          border-color: var(--color-active-bg);
          color: var(--color-active-bg);
          background: var(--color-active-text);
        }
        input::placeholder {
          color: var(--color-highlight);
        }
        input:focus {
          background: var(--color-active-text);
        }
        input[type=submit] {
          height: var(--17-units);
          padding: 0 var(--6-units);
          margin: var(--input-margin);
          background: var(--color-highlight);
        }
        input[type=submit]:hover {
          background: var(--color-active-bg);
          color: var(--color-active-text);
        }
      </style>

      ${showIfElse(getIsLoggedIn, 'loggedIn', header)}
    `, recaller, elementName)
  }
})
