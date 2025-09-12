import { TurtleDictionary } from '../turtle/TurtleDictionary.js'
import { Assert } from './Assert.js'
import { logError } from './logger.js'
import { Recaller } from './Recaller.js'
import { ERROR, FAILED, ONLY, PASSED, RUNNER, RUNNING, SKIP, SKIPPED, SUITE, TEST, WAITING } from './TestRunnerConstants.js'

export function urlToName (url) {
  if (typeof window !== 'undefined' && window?.location?.origin && url.startsWith(window.location.origin)) {
    url = url.slice(window.location.origin.length)
    const slashCpk = url.match(/\/[0-9A-Za-z]{41,51}(?=\/)/)?.[0]
    url = url.slice(slashCpk.length)
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
    this.#runState = WAITING
    this.assert = new Assert(this)
    this.runIndex = 0
    this.upserter = new TurtleDictionary(name, recaller)
  }

  async run () {
    this.#runPromise ??= (async () => {
      this.runState = RUNNING
      try {
        if (this.#f) await this.#f(this)
        await this.runChildren()
      } catch (error) {
        this.error = error
        if (this.verbose) logError(() => console.error(error))
        if (!(error instanceof TestRunnerError)) {
          logError(() => console.error(error))
          this.caught(`caught error: ${error.message}`, () => { throw new TestRunnerError(`${this.name}.run`, { cause: error }) })
        }
        this.runState = FAILED
      }
    })()
    return this.#runPromise
  }

  async runChildren () {
    this.#runChildrenPromise ??= (async () => {
      ++this.runIndex
      const errors = []
      const hasOnly = this.#children.some(child => child.type === ONLY)
      for (const child of this.#children) {
        if (hasOnly && child.type !== ONLY) child.runState = SKIPPED
        if (child.type === SKIP) child.runState = SKIPPED
        if (child.runState !== SKIPPED) await child.run()
        if (child.runState === FAILED) errors.push(child.error)
      }
      if (errors.length) {
        throw new TestRunnerError(`${this.name}.runChildren`, { cause: errors })
      }
      this.runState = PASSED
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

  /**
   * @param {string} name
   * @param {(runner: TestRunner) => any} f
   * @param {string} type
   * @returns {TestRunner}
   */
  appendChild (name, f, type) {
    const child = new TestRunner(name, type, this, f, this.recaller, this.verbose)
    this.#children.push(child)
    this.#runChildrenPromise = undefined
    this.recaller.reportKeyMutation(this, 'children', 'appendChild', this.name)
    return child
  }

  clearChildren () {
    this.#children = []
    this.#runChildrenPromise = undefined
    this.recaller.reportKeyMutation(this, 'children', 'clearChildren', this.name)
  }

  /**
   * @param {string} name
   * @param {(suite: TestRunner) => any} f
   * @returns {TestRunner}
   */
  describe (name, f) {
    return this.appendChild(name, f, SUITE)
  }

  /**
   * @param {string} name
   * @param {(test: TestRunner) => any} f
   * @returns {TestRunner}
   */
  it (name, f) {
    return this.appendChild(name, f, TEST)
  }

  /**
   * @param {string} name
   * @param {(test: TestRunner) => any} f
   * @returns {TestRunner}
   */
  test (name, f) {
    return this.appendChild(name, f, TEST)
  }

  /**
   * @param {string} name
   * @param {(test: TestRunner) => any} f
   * @returns {TestRunner}
   */
  caught (name, f) {
    return this.appendChild(name, f, ERROR)
  }

  /**
   * @returns {TestRunner}
   */
  get only () {
    return this.appendChild('only', () => {}, ONLY)
  }

  /**
   * @returns {TestRunner}
   */
  get skip () {
    return this.appendChild('skip', () => {}, SKIP)
  }
}

export const globalTestRunner = new TestRunner('globalTestRunner')
