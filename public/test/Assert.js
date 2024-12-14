import { ASSERTION, FAIL } from './constants.js'
import { RunnerError } from './Runner.js'

export class Assert {
  /**
   *
   * @param {import ('./Runner.js').Runner} runner
   */
  constructor (runner) {
    this.runner = runner
  }

  async isTruthy (valueToCheck, passMessage = 'true', failMessage = `NOT ${passMessage}`, cause) {
    if (valueToCheck) {
      return this.runner.appendChild(passMessage, () => cause, ASSERTION)
    } else {
      return this.runner.appendChild(failMessage, () => { throw new RunnerError(failMessage, { cause }) }, ASSERTION)
    }
  }

  async equal (actual, expected, message, debug = true) {
    const passMessage = message ?? 'expected === actual'
    const failMessage = message ?? 'expected !== actual'
    if (actual === expected) return this.isTruthy(true, passMessage)
    const expectedAddress = this.runner.upserter.upsert(expected)
    const actualAddress = this.runner.upserter.upsert(actual)
    const isEqual = await this.isTruthy(
      expectedAddress === actualAddress,
      passMessage,
      failMessage,
      { expectedAddress, actualAddress }
    )
    if (isEqual.runState === FAIL) {
      printDiff(this.runner.upserter, expectedAddress, actualAddress)
    }
    return isEqual
  }

  async notEqual (actual, expected, message) {
    const passMessage = message ?? 'expected !== actual'
    const failMessage = message ?? 'expected === actual'
    if (expected === actual) this.isTruthy(false, null, failMessage)
    const expectedAddress = this.runner.upserter.upsert(expected)
    const actualAddress = this.runner.upserter.upsert(actual)
    return this.isTruthy(
      expectedAddress !== actualAddress,
      passMessage,
      failMessage,
      { expectedAddress, actualAddress }
    )
  }

  async isAbove (valueToCheck, valueToBeAbove, message) {
    return this.isTruthy(valueToCheck > valueToBeAbove, message)
  }

  async isBelow (valueToCheck, valueToBeBelow, message) {
    return this.isTruthy(valueToCheck < valueToBeBelow, message)
  }

  async throw (f, message) {
    let threw = false
    try {
      f()
    } catch (error) {
      threw = true
    }
    return this.isTruthy(threw, message)
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
