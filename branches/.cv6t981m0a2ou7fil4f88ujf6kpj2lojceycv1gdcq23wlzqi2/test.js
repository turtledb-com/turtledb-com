import { TurtleDB } from './js/turtle/connections/TurtleDB.js'
import { Recaller } from './js/utils/Recaller.js'
import { globalTestRunner, testRunnerRecaller, urlToName } from './js/utils/TestRunner.js'
import { webSocketMuxFactory } from './js/utils/webSocketMuxFactory.js'
import { h } from './js/display/h.js'
import { render } from './js/display/render.js'
import { showIfElse, mapEntries } from './js/display/helpers.js'
import { ASSERTION, FAILED, PASSED, RUNNER, RUNNING, SUITE, TEST } from './js/utils/TestRunnerConstants.js'
import { AS_REFS } from './js/turtle/codecs/CodecType.js'

const recaller = new Recaller('test.js')
const turtleDB = new TurtleDB('test.js', recaller)

const cpk = document.baseURI.match(/(?<=\/)[0-9A-Za-z]{41,51}(?=\/)/)?.[0] || 'cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2'

const path = ['document', 'value']

webSocketMuxFactory(turtleDB, async tbMux => {
  window.tbMux = tbMux

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
      await globalTestRunner.run()
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
        if (this.runner.type !== TEST || this.runner.runState !== PASSED) detailsAttributes.open = 'open'
        return detailsAttributes
      }
      const order = () => {
        const stateRank = this.runner.runState === FAILED ? 1 : this.runner.runState === RUNNING ? 0 : this.runner.runState === PASSED ? 3 : 2
        return +this.key + (this.runner.parent?.children?.length || 1000) * stateRank 
      }
      render(this.shadowRoot, h`
      <style>
        :host {
          font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";
          order: ${order};
        }
        .children {
          display: flex;
          flex-direction: column;
        }

        details {
          transition: 0.2s all ease-out;
        }
        summary {
          list-style: none;
        }
        details summary {
          cursor: pointer;
        }
        details summary::after {
          content: ' ►';
        }
        details[open] summary:after {
          content: ' ▼';
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
        .run-state {
          display: inline-block;
          height: 1rem;
          width: 1rem;
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
        .${PASSED} .type,
        .${PASSED} .run-state {
          color: #0c0;
        }
        .${PASSED} .name {
          color: #040;
        }
        .${FAILED} .type,
        .${FAILED} .run-state {
          color: #f00;
        }
        .${FAILED} .name {
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
          .${PASSED} .type,
          .${PASSED} .run-state {
            color: #0f0;
          }
          .${PASSED} .name {
            color: #ada;
          }
          .${FAILED} .type,
          .${FAILED} .run-state {
            color: #f00;
          }
          .${FAILED} .name {
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
            ${mapEntries(() => this.runner.children, (child, index) => 
              h`<${elementName} runner=${child} key=${index}/>`
            )}
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
  render(document.body, h`
    <${elementName} runner=${globalTestRunner} key="global"/>
  `, testRunnerRecaller, 'test/index.js-render')
})
