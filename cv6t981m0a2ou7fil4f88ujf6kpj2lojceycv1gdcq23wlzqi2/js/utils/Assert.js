// import { ASSERTION, FAIL } from './constants.js'
import { TestRunnerError } from './TestRunner.js'
import { ASSERTION, FAIL } from './TestRunnerConstants.js'

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
   *
   * @param {import ('./Runner.js').Runner} runner
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
    if (isEqual.runState === FAIL) {
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
 * @param {import('../js/dataModel/Uint8ArrayLayer.js').Uint8ArrayLayer} uint8ArrayLayer
 * @param {number} a
 * @param {number} b
 * @param {string} prefix
 */
export function printDiff (uint8ArrayLayer, a, b, indent = '') {
  if (a === undefined || b === undefined) {
    if (a) {
      console.log(`${indent}${JSON.stringify(uint8ArrayLayer.getValue(a))} !== undefined`)
    } else {
      console.log(`${indent}undefined !== ${JSON.stringify(uint8ArrayLayer.getValue(b))}`)
    }
    return
  }
  if (indent.length > 20) return
  const aRefs = uint8ArrayLayer.getRefs(a)
  const bRefs = uint8ArrayLayer.getRefs(b)
  if (aRefs && bRefs && typeof aRefs === 'object' && typeof bRefs === 'object') {
    const attributes = new Set([...Object.keys(aRefs), ...Object.keys(bRefs)])
    for (const attribute of attributes) {
      if (aRefs[attribute] !== bRefs[attribute]) {
        console.log(`${indent}${attribute} - a:${a}, b:${b}`)
        printDiff(uint8ArrayLayer, aRefs[attribute], bRefs[attribute], `${indent}  `)
      }
    }
  } else {
    console.log(`${indent}${JSON.stringify(uint8ArrayLayer.getValue(a))} !== ${JSON.stringify(uint8ArrayLayer.getValue(b))}`)
  }
}
