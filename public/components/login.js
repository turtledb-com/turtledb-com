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
  return pointer instanceof Committer
}

window.customElements.define(elementName, class extends window.HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
  }

  signIn (e, el) {
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

  connectedCallback () {
    render(this.shadowRoot, () => h`
      <style>
        :host {
          --1-unit: 0.125rem;
          --2-units: calc(2 * var(--1-unit));
          --3-units: calc(3 * var(--1-unit));
          --5-units: calc(5 * var(--1-unit));
          --6-units: calc(6 * var(--1-unit));
          --8-units: calc(8 * var(--1-unit));
          --12-units: calc(12 * var(--1-unit));
          --16-units: calc(16 * var(--1-unit));
          --17-units: calc(17 * var(--1-unit));
          --color-1: DarkSeaGreen;
          --color-2: Honeydew;
          --color-3: Black;
          --color-4: MediumSeaGreen;
          --input-border: var(--1-unit) solid var(--color-1);
          --input-margin-borderless: var(--2-units) var(--2-units);
          --input-margin: var(--1-unit) var(--2-units);
          color: var(--color-1);
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          margin: 0;
          padding: var(--3-units) var(--8-units) var(--1-unit);
          border-bottom: var(--1-unit) solid var(--color-1);
          background: var(--color-2);
          align-items: center;
          font-size: var(--8-units);
        }

        :host:hover {
          background: red;
        }

        form {
          color: var(--color-1);
          margin: 0;
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
        }

        img {
          transition: all 200ms;
          height: var(--16-units);
          width: var(--16-units);
        }

        div {
          position: relative;
          margin: var(--input-margin);
        }
        button,
        input {
          border-radius: var(--6-units);
          height: var(--6-units);
          padding: var(--6-units);
          background-color: var(--color-2);
          border: var(--input-border);
          outline: none;
          box-sizing: content-box;
          font-size: var(--8-units);
        }
        button,
        input[type=submit] {
          height: var(--17-units);
          padding: 0 var(--12-units);
        }
        input[type=submit] {
          background: var(--color-1);
        }
        button:hover,
        input:hover + label,
        input:hover {
          border-color: var(--color-3);
          color: var(--color-3);
        }
        button:hover,
        input[type=submit]:hover {
          background: var(--color-3);
          color: var(--color-2);
        }
        button:hover img {
          filter: grayscale(100%) contrast(300%);
        }
        label {
          font-size: var(--8-units);
          position: absolute;
          left: var(--5-units);
          top: var(--5-units);
          background: var(--color-2);
          transition: transform 200ms;
          pointer-events: none;
          transform-origin: left;
          padding: 0 var(--1-unit);
        }
        input::placeholder {
          color: var(--color-4);
        }
        input:focus + label,
        input:not(:placeholder-shown) + label {
          transform: translateY(calc(-50% - var(--6-units))) scale(.8);
        }
      </style>

      ${showIfElse(getIsLoggedIn, h`
        loggedIn
      `, h`
        <button>
          <img src="../tinker.svg" alt="Tinker: your adorable mascot turtle (and a button)... what a scamp!" />
        </button>
        <form onsubmit=${handle(this.signIn)}>
          <span>
            Load/Create Turtle:
          </span>
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

          <input type="submit" />
        </form>
      `)}

    `, recaller, elementName)
  }
})
