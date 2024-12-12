import { defaultCPK } from '../js/constants.js'
import { h } from '../js/display/h.js'
import { mapEntries, showIfElse } from '../js/display/helpers.js'
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
    const summary = h`
      <summary>
        <span class="type">${() => this.runner.type}</span>
        <span class="run-state">${() => this.runner.runState}</span>
        <span class="name">${() => this.runner.name}</span>
      </summary>
    `
    const runnerCardClass = ['runner-card', this.runner.type, this.runner.runState].join(' ')
    render(this.shadowRoot, () => h`
      <style>
        :host {
          font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";
        }

        .runner-card {
          border-left: 1px solid #ddd;
          padding: 0 1rem;
          margin: 0.2rem 1rem;
          border-radius: 0.5rem;
          color: #888;
        }
        .${RUNNER} {
        }
        .${SUITE} {
          margin-top: 1rem;
        }
        .${TEST} {
        }
        .${ASSERTION} {
        }
        .${PASS} .type,
        .${PASS} .run-state {
          color: #0c0;
        }
        .${PASS} .name {
          color: #040;
        }
        .${FAIL} .type,
        .${FAIL} .run-state {
          color: #f00;
        }
        .${FAIL} .name {
          color: #a00;
        }
        .${RUNNING} .type,
        .${RUNNING} .run-state {
          color: #fa0;
        }
        .${RUNNING} .name {
          color: #a80;
        }

        @media (prefers-color-scheme: dark) {
          .runner-card {
            border-left: 1px solid #444;
            background: black;
          }
          .${PASS} .type,
          .${PASS} .run-state {
            color: #0f0;
          }
          .${PASS} .name {
            color: #ada;
          }
          .${FAIL} .type,
          .${FAIL} .run-state {
            color: #f00;
          }
          .${FAIL} .name {
            color: #f88;
          }
          .${RUNNING} .type,
          .${RUNNING} .run-state {
            color: #fa0;
          }
          .${RUNNING} .name {
            color: #fda;
          }
        }
      </style>
      ${showIfElse(() => this.runner.children.length, h`
        <details ${(this.runner.type === '⇶' && this.runner.runState === '✓') ? [] : 'open'} class=${runnerCardClass}>
          ${summary}
          <div class="children">
            ${mapEntries(() => this.runner.children, (child, index) => h`<${elementName} runner=${child} key=${index}/>`)}
          </div>
        </details>
      `, h`
        <div class=${runnerCardClass}>
          ${summary}
        <div>
      `)}
    `, runnerRecaller, elementName)
  }
})

console.log('\n\n89890890890')
// runnerRecaller.debug = true
render(document.body, () => h`
  <${elementName} runner=${globalRunner} key="global"/>
`, runnerRecaller, 'test/index.js-render')
