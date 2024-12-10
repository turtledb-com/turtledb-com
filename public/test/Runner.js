import chalk from 'chalk'
import { Upserter } from '../js/dataModel/Upserter.js'
import { Recaller } from '../js/utils/Recaller.js'
import { Assert } from './Assert.js'

export const PASS = '✓'
export const FAIL = '✖'
export const WAIT = '⧖'
export const RUNNING = '…'
export const SKIP = '•'

export function urlToName (url) {
  return /(?<=\/public\/).*/.exec(url)?.[0] ?? url
}

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
   * @param {Upserter} [upserter=new Upserter(name, recaller)]
   */
  constructor (
    name = 'test-collection',
    type = 'Runner',
    parent,
    f,
    recaller = runnerRecaller,
    verbose = 1,
    upserter = new Upserter(name, recaller)
  ) {
    this.parent = parent
    this.name = name
    this.type = type
    this.#f = f
    this.recaller = recaller
    this.verbose = verbose
    this.upserter = upserter
    this.#runState = WAIT
    this.assert = new Assert(this)
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
    await this.parent?.rerunChildren?.()
  }

  async runChildren () {
    // console.group('vvv runChildren', this.name, this.type)
    const errors = []
    for (const child of this.#children) {
      await child.run()
      if (child.runState === FAIL) errors.push(child.error)
    }
    // console.groupEnd()
    // console.log('^^^ ranChildren', this.name, this.type)
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
    let header = `${indent}${this.runState} ${this.name} ${this.type}`
    if (this.runState === FAIL) header = `${indent}${chalk.red(this.runState)} ${chalk.red(this.name)} ${this.type}`
    else if (this.runState === PASS) header = `${indent}${chalk.green(this.runState)} ${this.name} ${this.type}`
    else header = `${indent}${chalk.yellow(this.runState)} ${chalk.yellow(this.name)} ${this.type}`
    return [
      header,
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
}

export const globalRunner = new Runner('global')
