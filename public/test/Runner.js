import { Recaller } from '../js/utils/Recaller.js'

// export const PASS = '✅'
export const PASS = '✓'
// export const FAIL = '❌'
export const FAIL = '✖'
// export const RUNNING = '⏳'
export const WAIT = '⧖'
export const RUNNING = '…'
// export const SKIP = '🚫'
export const SKIP = '•'

export const runnerRecaller = new Recaller('Runner.js')
// runnerRecaller.debug = true
let runnerCount = 0

export class Runner {
  /** @type {Array.<Runner>} */
  #children = []
  #runState
  #f

  /**
   * @param {string} [name='test-collection']
   * @param {string} [type='Runner']
   * @param {Runner} parent
   * @param {number} [verbose=1]
   * @param {Recaller} [recaller=runnerRecaller]
   * @param {() => void} [f=() => {}]
   */
  constructor (
    name = 'test-collection',
    type = 'Runner',
    parent,
    verbose = 1,
    recaller = runnerRecaller,
    f = () => this.runChildren()
  ) {
    this.parent = parent
    this.name = name
    this.type = type
    this.verbose = verbose
    this.recaller = recaller
    this.runState = WAIT
    this.#f = f
    this.index = parent?.index ?? ++runnerCount
  }

  async run () {
    this.runState = RUNNING
    try {
      this.result = await this.#f(this)
      this.runState = PASS
    } catch (error) {
      this.error = error
      this.runState = FAIL
    }
  }

  async runChildren () {
    const errors = []
    for (const child of this.children) {
      await child.run()
      if (child.runState === FAIL) errors.push(child.error)
    }
    if (errors.length) {
      throw new Error(this.name, { cause: errors })
    }
    return true
  }

  get status () {
    return {
      name: this.name,
      type: this.type,
      index: this.index,
      runState: this.runState,
      children: this.children.map(child => child.status)
    }
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
   * @param {string} type
   * @param {string} name
   * @param {(runner: Runner) => any} f
   * @returns {Runner}
   */
  async appendChild (name, f, type) {
    const child = new Runner(name, type, this, this.verbose, this.recaller, f)
    this.#children.push(child)
    this.recaller.reportKeyMutation(this, 'children', 'appendChild', this.name)
    if (this.runState === RUNNING) {
      await child.run()
    }
  }

  /**
   * @param {string} name
   * @param {(runner: Runner) => any} f
   * @returns {Runner}
   */
  async describe (name, f) {
    return this.appendChild(name, f, 'Suite')
  }

  /**
   * @param {string} name
   * @param {(runner: Runner) => any} f
   * @returns {Runner}
   */
  async it (name, f) {
    return this.appendChild(name, f, 'Test')
  }

  /**
   * @param {string} name
   * @param {(runner: Runner) => any} f
   * @returns {Runner}
   */
  async test (name, f) {
    return this.appendChild(name, f, 'Test')
  }

  async equal (expected, actual, message = `expected === actual : ${JSON.stringify(expected)} === ${JSON.stringify(actual)}`, runImmediately = true) {
    this.appendChild(message, () => {
      const equal = expected === actual
      if (!equal) throw new Error(message)
    }, 'equal')
  }

  /** @type {Array.<Runner>} */
  static completedRunners = []
  static #currentRunner
  /** @type {Runner} */
  static get currentRunner () {
    if (!this.#currentRunner || this.#currentRunner.isComplete) this.#currentRunner = new Runner()
    return this.#currentRunner
  }

  /** @type {Runner} */
  static get lastRunner () { return this.completedRunners[this.completedRunners.length - 1] }
}

const runner = Runner.currentRunner
/*
runnerRecaller.watch('update status', () => {
  console.log(JSON.stringify(runner.status, undefined, 2))
})
*/
runner.describe('abc', async suite => {
  await suite.it('xyz', async assert => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    assert.equal(1, 1)
    await new Promise(resolve => setTimeout(resolve, 1000))
    assert.equal(1, 1)
    await new Promise(resolve => setTimeout(resolve, 1000))
  })
})

console.log('--- start run')
await runner.run()
console.log(JSON.stringify(runner.status, undefined, 2))
