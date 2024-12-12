import { defaultCPK } from '../js/constants.js'
import { h } from '../js/display/h.js'
import { mapEntries } from '../js/display/helpers.js'
import { render } from '../js/display/render.js'
import { getPointerByPublicKey, peerRecaller } from '../js/net/Peer.js'
import { connectPeer } from '../js/utils/connectPeer.js'
import { ASSERTION, FAIL, PASS, RUNNER, RUNNING, SUITE, TEST } from './constants.js'
import { globalRunner, runnerRecaller, urlToName } from './Runner.js'

const pointer = getPointerByPublicKey(defaultCPK)

await globalRunner.run()

connectPeer(peerRecaller).catch(err => {
  console.log(err)
})

pointer.recaller.watch('load-tests', async () => {
  const fsRefs = pointer.getRefs('value', 'fs')
  if (fsRefs) {
    const paths = Object.keys(fsRefs).filter(path => /\.test\.js$/.test(path))
    await Promise.all(paths.map(async path => {
      const importPath = `/${path}?address=${fsRefs[path]}&cpk=${defaultCPK}`
      try {
        await import(importPath)
        console.log('imported', importPath)
      } catch (error) {
        globalRunner.describe(urlToName(importPath), suite => {
          suite.it(`import error: ${error.message}`, () => { throw error })
        })
        console.error(error)
      }
    }))
    await globalRunner.rerunChildren()
    console.log(globalRunner.status)
  }
})

const elementName = 'runner-status'

window.customElements.define(elementName, class extends window.HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
  }

  attributeChangedCallback (name, oldValue, newValue) {
    console.log(name, oldValue, newValue)
  }

  connectedCallback () {
    render(this.shadowRoot, () => h`
      <style>
        :host {
          font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";
        }

        @media (prefers-color-scheme: dark) {
          .runner-card {
            background: black;
            color: white;
          }
        }
        .runner-card {
          outline: 1px solid gray;
          padding: 0 1rem;
          margin: 0.2rem 1rem;
          border-radius: 0.5rem;
        }
        .${RUNNER} {
        }
        .${SUITE} {
        }
        .${TEST} {
        }
        .${ASSERTION} {
        }
        .${PASS} .run-state {
          color: green;
        }
        .${FAIL} .run-state,
        .${FAIL} .type,
        .${FAIL} .name {
          color: red;
        }

        .${RUNNING} .run-state,
        .${RUNNING} .type,
        .${RUNNING} .name {
          color: orange;
        }
      </style>
      <details ${(this.runner.type === '⇶' && this.runner.runState === '✓') ? [] : 'open'} class="runner-card ${this.runner.type} ${this.runner.runState}">
        <summary>
          <span class="type">${() => this.runner.type}</span>
          <span class="run-state">${() => this.runner.runState}</span>
          <span class="name">${() => this.runner.name}</span>
        </summary>
        <div class="children">
          ${mapEntries(() => this.runner.children, (child, index) => h`<${elementName} runner=${child} key=${index}/>`)}
        </div>
      </details>
    `, runnerRecaller, elementName)
  }
})

console.log('\n\n89890890890')
// runnerRecaller.debug = true
render(document.body, () => h`
  <${elementName} runner=${globalRunner} key="global"/>
`, runnerRecaller, 'test/index.js-render')
