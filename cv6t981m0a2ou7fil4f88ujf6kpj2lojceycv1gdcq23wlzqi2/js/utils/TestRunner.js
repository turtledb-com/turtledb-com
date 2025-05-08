// import { Upserter } from '../js/dataModel/Upserter.js'
// import { Recaller } from '../js/utils/Recaller.js'
// import { Assert } from './Assert.js'

import { Assert } from './Assert.js'
import { Recaller } from './Recaller.js'
import { ERROR, FAIL, ONLY, PASS, RUNNER, RUNNING, SUITE, TEST, WAIT } from './TestRunnerConstants.js'

export function urlToName (url) {
  if (typeof window !== 'undefined' && window?.location?.origin && url.startsWith(window.location.origin)) {
    url = url.slice(window.location.origin.length)
  }
  url = /(?<=\/public\/).*/.exec(url)?.[0] ?? url
  const parsed = /(?<path>[^?]*)\.test\.js?.*address=(?<address>[^&]*)/.exec(url)
  if (parsed) url = `${parsed.groups.path} [&${parsed.groups.address}]`
  return url
}

export const testRunnerRecaller = new Recaller('TestRunner')
// testRunnerRecaller.debug = true

export class TestRunnerError extends Error {
  constructor (message, options) {
    super(message, options)
    this.name = this.constructor.name
  }
}

export class TestRunner {
  /** @type {Array.<TestRunner>} */
  #children = []
  /** @type {TestRunner} */
  #only
  /** @type {Promise} */
  #runPromise
  #runChildrenPromise
  #runState
  #f

  /**
   * @param {string} [name='test-collection']
   * @param {string} [type=RUNNER]
   * @param {TestRunner} parent
   * @param {() => void} f
   * @param {Recaller} [recaller=testRunnerRecaller]
   * @param {number} [verbose=0]
   */
  constructor (
    name = 'unnamed-test-runner',
    type = RUNNER,
    parent,
    f,
    recaller = testRunnerRecaller,
    verbose = 0
  ) {
    this.parent = parent
    this.name = name
    this.type = type
    this.#f = f
    this.recaller = recaller
    this.verbose = verbose
    this.#runState = WAIT
    this.assert = new Assert(this)
    this.runIndex = 0
  }

  async run () {
    this.#runPromise ??= (async () => {
      // console.group('vvv run', this.name, this.type)
      this.runState = RUNNING
      try {
        if (this.#f) await this.#f(this)
        await this.runChildren()
      } catch (error) {
        this.error = error
        if (this.verbose) console.error(error)
        if (!(error instanceof TestRunnerError)) {
          console.error(error)
          this.caught(`caught error: ${error.message}`, () => { throw new TestRunnerError(`${this.name}.run`, { cause: error }) })
        }
        this.runState = FAIL
      }
      // console.groupEnd()
      // console.log('^^^ ran', this.name, this.type)
    })()
    return this.#runPromise
  }

  async rerunChildren () {
    this.runState = RUNNING
    try {
      await this.runChildren()
    } catch (error) {
      this.error = error
      this.runState = FAIL
    }
  }

  async runChildren () {
    this.#runChildrenPromise ??= (async () => {
      ++this.runIndex
      // console.group('vvv runChildren', this.name, this.type)
      const errors = []
      if (this._only) {
        await this._only.run()
        if (this._only.runState === FAIL) errors.push(this._only.error)
      } else {
        for (const child of this.#children) {
          await child.run()
          if (child.runState === FAIL) errors.push(child.error)
        }
      }
      // console.groupEnd()
      // console.log('^^^ ranChildren', this.name, this.type)
      if (errors.length) {
        throw new TestRunnerError(`${this.name}.runChildren`, { cause: errors })
      }
      this.runState = PASS
    })()
    return this.#runChildrenPromise
  }

  get status () {
    const status = {
      name: this.name,
      type: this.type,
      runState: this.runState,
      children: this.children.map(child => child.status)
    }
    if (this._only) status.only = this._only.status
    return status
  }

  get children () {
    this.recaller.reportKeyAccess(this, 'children', 'get', this.name)
    return this.#children
  }

  get runState () {
    this.recaller.reportKeyAccess(this, 'runState', 'get', this.name)
    return this.#runState
  }

  set runState (runState) {
    this.recaller.reportKeyMutation(this, 'runState', 'get', this.name)
    this.#runState = runState
  }

  get only () {
    if (!this.#only) {
      this.recaller.reportKeyMutation(this, 'only', 'init', this.name)
      this.#only = new TestRunner('only', ONLY, this, this.#f, this.recaller, this.verbose)
      if (this.runState === RUNNING) {
        this.#only.#runState = RUNNING
      }
    }
    return this._only
  }

  get _only () {
    this.recaller.reportKeyAccess(this, 'only', 'get', this.name)
    return this.#only
  }

  /**
   * @param {string} name
   * @param {(runner: TestRunner) => any} f
   * @param {string} type
   * @returns {TestRunner}
   */
  async appendChild (name, f, type) {
    const child = new TestRunner(name, type, this, f, this.recaller, this.verbose)
    this.#children.push(child)
    this.#runChildrenPromise = undefined
    this.recaller.reportKeyMutation(this, 'children', 'appendChild', this.name)
    if (this.runState === RUNNING) {
      await child.run()
    }
    return child
  }

  clearChildren () {
    this.#children = []
    this.#only = undefined
    this.recaller.reportKeyMutation(this, 'only', 'clearChildren', this.name)
    this.#runChildrenPromise = undefined
    this.recaller.reportKeyMutation(this, 'children', 'clearChildren', this.name)
  }

  /**
   * @param {string} name
   * @param {(suite: TestRunner) => any} f
   * @returns {TestRunner}
   */
  async describe (name, f) {
    return this.appendChild(name, f, SUITE)
  }

  /**
   * @param {string} name
   * @param {(test: TestRunner) => any} f
   * @returns {TestRunner}
   */
  async it (name, f) {
    return this.appendChild(name, f, TEST)
  }

  /**
   * @param {string} name
   * @param {(test: TestRunner) => any} f
   * @returns {TestRunner}
   */
  async test (name, f) {
    return this.appendChild(name, f, TEST)
  }

  /**
   * @param {string} name
   * @param {(test: TestRunner) => any} f
   * @returns {TestRunner}
   */
  async caught (name, f) {
    return this.appendChild(name, f, ERROR)
  }
}

export const globalTestRunner = new TestRunner('globalTestRunner')
