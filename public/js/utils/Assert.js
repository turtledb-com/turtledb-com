import { AS_REFS } from '../turtle/codecs/CodecType.js'
import { logInfo } from './logger.js'
import { TestRunnerError } from './TestRunner.js'
import { ASSERTION, FAILED } from './TestRunnerConstants.js'

const TON = {
  replacer: function (_key, value) {
    if (value instanceof Object.getPrototypeOf(Uint8Array)) return { [value.constructor.name]: [...value.values()] }
    if (typeof value === 'bigint') return { BigInt: value.toString() }
    if (value instanceof Date) return { Date: value.toISOString() }
    return value
  },
  stringify: function (value, space = 2) {
    return JSON.stringify(TON.replacer(undefined, value), TON.replacer, space)
  }
}

export class Assert {
  /**
   * @param {import ('./TestRunner.js').TestRunner} runner
   */
  constructor (runner) {
    this.runner = runner
  }

  async assert (valueToCheck, passMessage = 'truthy', failMessage = `NOT ${passMessage}`, cause) {
    if (valueToCheck) {
      return this.runner.appendChild(passMessage, () => cause, ASSERTION)
    } else {
      return this.runner.appendChild(failMessage, () => { throw new TestRunnerError(failMessage, { cause }) }, ASSERTION)
    }
  }

  async equal (actual, expected, message, debug = true) {
    const passMessage = `${TON.stringify(actual)} === ${TON.stringify(expected)}`
    if (actual === expected) return this.assert(true, passMessage)
    const expectedAddress = this.runner.upserter.upsert(expected)
    const actualAddress = this.runner.upserter.upsert(actual)
    const failMessage = message ?? `${TON.stringify(actual)} !== ${TON.stringify(expected)}`
    const isEqual = await this.assert(
      expectedAddress === actualAddress,
      passMessage,
      failMessage,
      { runner: this.runner, expectedAddress, actualAddress }
    )
    if (isEqual.runState === FAILED) {
      printDiff(this.runner.upserter, expectedAddress, actualAddress)
    }
    return isEqual
  }

  async notEqual (actual, expected, message) {
    const passMessage = `${TON.stringify(actual)} !== ${TON.stringify(expected)}`
    const failMessage = message ?? `${TON.stringify(actual)} === ${TON.stringify(expected)}`
    if (expected === actual) this.assert(false, null, failMessage)
    const expectedAddress = this.runner.upserter.upsert(expected)
    const actualAddress = this.runner.upserter.upsert(actual)
    return this.assert(
      expectedAddress !== actualAddress,
      passMessage,
      failMessage,
      { runner: this.runner, expectedAddress, actualAddress }
    )
  }

  async isAbove (valueToCheck, valueToBeAbove, message) {
    return this.assert(valueToCheck > valueToBeAbove, message)
  }

  async isBelow (valueToCheck, valueToBeBelow, message) {
    return this.assert(valueToCheck < valueToBeBelow, message)
  }

  async throw (f, message) {
    let threw = false
    try {
      f()
    } catch (error) {
      threw = true
    }
    return this.assert(threw, message)
  }
}

/**
 *
 * @param {import('../turtle/TurtleBranch.js').TurtleBranch} turtleBranch
 * @param {number} a
 * @param {number} b
 * @param {string} prefix
 */
export function printDiff (turtleBranch, a, b, indent = '') {
  if (a === undefined || b === undefined) {
    if (a) {
      logInfo(() => console.log(`${indent}${JSON.stringify(turtleBranch.lookup(a))} !== undefined`))
    } else {
      logInfo(() => console.log(`${indent}undefined !== ${JSON.stringify(turtleBranch.lookup(b))}`))
    }
    return
  }
  if (indent.length > 20) return
  const aRefs = turtleBranch.lookup(a, AS_REFS)
  const bRefs = turtleBranch.lookup(b, AS_REFS)
  if (aRefs && bRefs && typeof aRefs === 'object' && typeof bRefs === 'object') {
    const attributes = new Set([...Object.keys(aRefs), ...Object.keys(bRefs)])
    for (const attribute of attributes) {
      if (aRefs[attribute] !== bRefs[attribute]) {
        logInfo(() => console.log(`${indent}${attribute} - a:${a}, b:${b}`))
        printDiff(turtleBranch, aRefs[attribute], bRefs[attribute], `${indent}  `)
      }
    }
  } else {
    logInfo(() => console.log(`${indent}${JSON.stringify(turtleBranch.lookup(a))} !== ${JSON.stringify(turtleBranch.lookup(b))}`))
  }
}
