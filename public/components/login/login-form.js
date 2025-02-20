import { h } from '../../js/display/h.js'
import { handle } from '../../js/display/helpers.js'
import { render } from '../../js/display/render.js'
import { deriveDefaults } from '../../js/utils/components.js'
import { hashNameAndPassword } from '../../js/utils/crypto.js'

const { recaller, elementName } = deriveDefaults(import.meta.url)

window.customElements.define(elementName, class extends window.HTMLElement {
  constructor () {
    super()
    console.log('\n\n   new form')
    this.attachShadow({ mode: 'open' })
  }

  signIn = (e, el) => {
    e.preventDefault()
    const formData = new FormData(el)
    el.reset()
    console.log(el, e, formData)
    const username = formData.get('username')
    const password = formData.get('password')
    const turtlename = formData.get('turtlename') || 'home'
    console.log({ username, password, turtlename })
    console.log(this.handleSignin)
    this.handleSignin(username, hashNameAndPassword(username, password), turtlename)
  }

  connectedCallback () {
    render(this.shadowRoot, () => h`
      <style>
        :host {
          margin-left: auto;
          transition: all 200ms;
          --1-unit: 0.125rem;
          --2-units: calc(2 * var(--1-unit));
          --3-units: calc(3 * var(--1-unit));
          --4-units: calc(4 * var(--1-unit));
          --6-units: calc(6 * var(--1-unit));
          --8-units: calc(8 * var(--1-unit));
          --17-units: calc(17 * var(--1-unit));
          --100-units: calc(100 * var(--1-unit));
          --color-bg: MediumSeaGreen;
          --color-text: SeaGreen;
          --color-active-bg: Black;
          --color-active-text: HoneyDew;
          --color-highlight: MediumSpringGreen;
          --input-border: var(--1-unit) solid var(--color-text);
          --input-margin: var(--1-unit) var(--2-units);
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
    `, recaller, elementName)
  }
})
