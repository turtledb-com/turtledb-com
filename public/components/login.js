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
          display: flex;
          margin: 0;
          border: 1px solid black;
        }

        form {
          display: flex;
          border: 1px solid black;
        }

        div {
          border: 1px solid black;
        }
      </style>

      ${showIfElse(getIsLoggedIn, h`
        loggedIn
      `, h`
        <form onsubmit=${handle(this.signIn)}>
          <div>
            <label for="username">username:</label>
            <input type="text" id="username" name="username" />
          </div>

          <div>
            <label for="pass">password:</label>
            <input type="password" id="pass" name="password" />
          </div>

          <div>
            <label for="turtlename">turtlename:</label>
            <input type="text" id="turtlename" name="turtlename" placeholder="home" />
          </div>

          <input type="submit" value="sign in" />
        </form>
      `)}

    `, recaller, elementName)
  }
})
