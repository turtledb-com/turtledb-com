import { TurtleDB } from './js/turtle/connections/TurtleDB.js'
import { Recaller } from './js/utils/Recaller.js'
import { globalTestRunner, testRunnerRecaller, urlToName } from './js/utils/TestRunner.js'
import { webSocketMuxFactory } from './js/utils/webSocketMuxFactory.js'
import { h } from './js/display/h.js'
import { render } from './js/display/render.js'
import { showIfElse, mapEntries } from './js/display/helpers.js'
import { ASSERTION, FAIL, PASS, RUNNER, RUNNING, SUITE, TEST } from './js/utils/TestRunnerConstants.js'
import { AS_REFS } from './js/turtle/codecs/CodecType.js'

const recaller = new Recaller('test.js')
const turtleDB = new TurtleDB('test.js', recaller)

const cpk = document.baseURI.match(/(?<=\/)[0-9A-Za-z]{41,51}(?=\/)/)?.[0]

const path = ['document', 'value', 'fs']

webSocketMuxFactory(turtleDB, async tbMux => {
  window.tbMux = tbMux

  await globalTestRunner.run()

  const turtleBranch = await turtleDB.summonBoundTurtleBranch(cpk)

  let alreadyRan
  turtleBranch.recaller.watch('load-tests', async () => {
    const fsRefs = turtleBranch.lookup(...path, AS_REFS)
    if (fsRefs) {
      if (alreadyRan) window.location.reload()
      alreadyRan = true
      const paths = Object.keys(fsRefs).filter(path => /\.test\.js$/.test(path))
      // globalTestRunner.clearChildren()
      for (const path of paths) {
      // await Promise.all(paths.map(async path => {
        const importPath = `./${path}?address=${fsRefs[path]}&head=${turtleBranch.length - 1}` // include head in path so that all tests rerun on any change
        try {
          await import(importPath)
        // console.log({ importPath })
        } catch (error) {
          globalTestRunner.describe(urlToName(importPath), suite => {
            suite.it(`import error: ${error.message}`, () => { throw error })
          })
          console.error(error)
        }
        // }))
      }
      await globalTestRunner.rerunChildren()
      console.log(globalTestRunner.status)
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
        ${showIfElse(() => this.runner._only, h`<${elementName} runner=${() => this.runner._only} key="only"/>`)}
      </summary>
    `
      const getRunnerCardClass = () => ['runner-card', this.runner.type, this.runner.runState].join(' ')
      const getDetailsAttributes = () => {
        const detailsAttributes = { class: getRunnerCardClass() }
        if (this.runner.type !== TEST || this.runner.runState !== PASS) detailsAttributes.open = 'open'
        return detailsAttributes
      }
      render(this.shadowRoot, h`
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
          background: linear-gradient(white, rgb(239, 247, 247));
        }
        .runner-card:open {
          padding: 0.5rem 1rem;
        }
        .${RUNNER} {
        }
        .${SUITE}:open {
          margin: 1rem;
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
            background: linear-gradient(rgb(31, 63, 47), black);
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
        <details ${getDetailsAttributes}>
          ${summary}
          <div class="children">
            ${mapEntries(() => this.runner.children, (child, index) => h`<${elementName} runner=${child} key=${index}/>`)}
          </div>
        </details>
      `, h`
        <div class=${getRunnerCardClass}>
          ${summary}
        <div>
      `)}
    `, testRunnerRecaller, elementName)
    }
  })

  console.log('\n\n89890890890')
  // testRunnerRecaller.debug = true
  render(document.body, h`
  <${elementName} runner=${globalTestRunner} key="global"/>
`, testRunnerRecaller, 'test/index.js-render')
})
