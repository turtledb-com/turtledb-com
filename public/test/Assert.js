import { ASSERTION } from './constants.js'
import { RunnerError } from './Runner.js'

export class Assert {
  /**
   *
   * @param {import ('./Runner.js').Runner} runner
   */
  constructor (runner) {
    this.runner = runner
  }

  async isAbove (valueToCheck, valueToBeAbove, message) {
    const cause = { valueToCheck, valueToBeAbove }
    if (valueToCheck > valueToBeAbove) {
      this.runner.appendChild(message, () => {
        return cause
      }, ASSERTION)
    } else {
      this.runner.appendChild(message, () => {
        throw new RunnerError(message, { cause })
      }, ASSERTION)
    }
  }

  async isBelow (valueToCheck, valueToBeBelow, message) {
    const cause = { valueToCheck, valueToBeBelow }
    if (valueToCheck < valueToBeBelow) {
      this.runner.appendChild(message, () => {
        return cause
      }, ASSERTION)
    } else {
      this.runner.appendChild(message, () => {
        throw new RunnerError(message, { cause })
      }, ASSERTION)
    }
  }

  async notEqual (actual, expected, message) {
    const expectedAddress = this.runner.upserter.upsert(expected)
    const actualAddress = this.runner.upserter.upsert(actual)
    const cause = { expectedAddress, actualAddress }
    if (expectedAddress === actualAddress) {
      message ??= 'expected === actual'
      this.runner.appendChild(message, () => {
        throw new RunnerError(message, { cause })
      }, ASSERTION)
    } else {
      message ??= 'expected !== actual'
      this.runner.appendChild(message, () => {
        return cause
      }, ASSERTION)
    }
  }

  async equal (actual, expected, message, debug = true) {
    const expectedAddress = this.runner.upserter.upsert(expected)
    const actualAddress = this.runner.upserter.upsert(actual)
    const cause = { expectedAddress, actualAddress }
    if (expectedAddress === actualAddress) {
      message ??= 'expected === actual'
      this.runner.appendChild(message, () => {
        return cause
      }, ASSERTION)
    } else {
      message ??= 'expected !== actual'
      this.runner.appendChild(message, () => {
        if (debug) {
          console.log(message)
          printDiff(this.runner.upserter, expectedAddress, actualAddress, '  ')
        }
        throw new RunnerError(message, { cause })
      }, ASSERTION)
    }
  }
}

/**
 *
 * @param {import('../js/dataModel/Uint8ArrayLayer.js').Uint8ArrayLayer} uint8ArrayLayer
 * @param {number} a
 * @param {number} b
 * @param {string} prefix
 */
function printDiff (uint8ArrayLayer, a, b, indent = '') {
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
