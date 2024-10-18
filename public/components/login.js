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
          --bg: Honeydew;
          --primary: DarkSeaGreen;
          --focus: Black;
          --placeholder: MediumSeaGreen;
          --border-width: 0.25em;
          --input-border: var(--border-width) solid var(--primary);
          --input-height: 1em;
          --input-margin-borderless: 0.25em 0.25em;
          --input-margin: 0.125em 0.25em;
          --pad: .75em;
          color: var(--primary);
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          margin: 0;
          padding: 0.375em 1em 0.25em;
          border-bottom: var(--border-width) solid var(--primary);
          background: var(--bg);
          align-items: center;
        }

        form {
          color: var(--primary);
          margin: 0;
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
        }

        img {
          height: 2em;
          width: 2em;
        }

        div {
          position: relative;
          margin: var(--input-margin);
        }
        button,
        input {
          border-radius: 0.6em;
          height: var(--pad);
          padding: var(--pad);
          background-color: var(--bg);
          border: var(--input-border);
          outline: none;
          box-sizing: content-box;
          font-size: var(--input-height);
        }
        button,
        input[type=submit] {
          margin: var(--input-margin-borderless);
          height: 2em;
          padding: 0 1.5em;
        }
        input[type=submit] {
          background: var(--primary);
        }
        button:hover,
        input:hover + label,
        input:hover {
          border-color: var(--focus);
          color: var(--focus);
        }
        button:hover,
        input[type=submit]:hover {
          background: var(--focus);
          color: var(--bg);
        }
        label {
          font-size: var(--input-height);
          position: absolute;
          left: var(--pad);
          top: var(--pad);
          background: var(--bg);
          transition: transform 200ms;
          pointer-events: none;
          transform-origin: left;
          padding: 0 var(--border-width);
        }
        input::placeholder {
          color: var(--placeholder);
        }
        input:focus + label,
        input:not(:placeholder-shown) + label {
          transform: translateY(calc(-50% - var(--pad))) scale(.8);
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
