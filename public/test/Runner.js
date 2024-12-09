import { Recaller } from '../js/utils/Recaller.js'
import { Assert } from './Assert.js'

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

export class Runner {
  /** @type {Array.<Runner>} */
  #children = []
  /** @type {Promise} */
  #runPromise
  #runState
  #f

  /**
   * @param {string} [name='test-collection']
   * @param {string} [type='Runner']
   * @param {Runner} parent
   * @param {() => void} f
   * @param {Recaller} [recaller=runnerRecaller]
   * @param {number} [verbose=1]
   */
  constructor (
    name = 'test-collection',
    type = 'Runner',
    parent,
    f,
    recaller = runnerRecaller,
    verbose = 1
  ) {
    this.parent = parent
    this.name = name
    this.type = type
    this.#f = f
    this.recaller = recaller
    this.verbose = verbose
    this.#runState = WAIT
    this.assert = new Assert(this)
  }

  async run () {
    this.#runPromise ??= (async () => {
      this.runState = RUNNING
      try {
        if (this.#f) await this.#f(this)
        await this.runChildren()
      } catch (error) {
        this.error = error
        this.runState = FAIL
      }
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
    await this.parent?.rerunChildren?.()
  }

  async runChildren () {
    const errors = []
    for (const child of this.#children) {
      await child.run()
      if (child.runState === FAIL) errors.push(child.error)
    }
    if (errors.length) {
      throw new Error(this.name, { cause: errors })
    }
    this.runState = PASS
  }

  get status () {
    return {
      name: this.name,
      type: this.type,
      runState: this.runState,
      children: this.children.map(child => child.status)
    }
  }

  toString (indent = '') {
    return [
      `${indent}${this.runState} ${this.name} ${this.type}`,
      ...this.children.map(child => child.toString(`${indent}  `))
    ].join('\n')
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
   * @param {(runner: Runner) => any} f
   * @param {string} type
   * @returns {Runner}
   */
  async appendChild (name, f, type) {
    const child = new Runner(name, type, this, f, this.recaller, this.verbose)
    this.#children.push(child)
    this.recaller.reportKeyMutation(this, 'children', 'appendChild', this.name)
    if (this.runState === RUNNING) {
      await child.run()
    }
  }

  /**
   * @param {string} name
   * @param {(suite: Runner) => any} f
   * @returns {Runner}
   */
  async describe (name, f) {
    return this.appendChild(name, f, 'Suite')
  }

  /**
   * @param {string} name
   * @param {(test: Runner) => any} f
   * @returns {Runner}
   */
  async it (name, f) {
    return this.appendChild(name, f, 'Test')
  }

  /**
   * @param {string} name
   * @param {(test: Runner) => any} f
   * @returns {Runner}
   */
  async test (name, f) {
    return this.appendChild(name, f, 'Test')
  }

  async equal (expected, actual, message = `expected === actual : ${JSON.stringify(expected)} === ${JSON.stringify(actual)}`, runImmediately = true) {
    await this.appendChild(message, () => {
      const equal = expected === actual
      if (!equal) throw new Error(message)
    }, 'equal')
  }
}

const runner = new Runner()
let _suite
// runnerRecaller.watch('update status', () => {
//   console.log(JSON.stringify(runner.status, undefined, 10))
// })
runner.describe('abc', suite => {
  _suite = suite
  suite.it('xy', async (assert) => {
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(1, 1)
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(2, 2)
    await new Promise(resolve => setTimeout(resolve, 100))
  })
  suite.it('z', async (assert) => {
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.assert.equal(3, 3)
  })
})

console.log('---')
console.log(runner.toString())
console.log('---')
console.log('--- start run')
await runner.run()
console.log('---')
console.log(runner.toString())
console.log('---')

_suite.it('m', async (assert) => {
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.assert.equal(4, 5)
  await new Promise(resolve => setTimeout(resolve, 100))
})

runner.describe('n', async (assert) => {
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.assert.equal(5, 5)
  await new Promise(resolve => setTimeout(resolve, 100))
})

console.log('---')
console.log(runner.toString())
console.log('---')

await _suite.rerunChildren()
console.log('---')
console.log(runner.toString())
console.log('---')

console.log(import.meta.url)
