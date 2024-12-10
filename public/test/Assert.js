export class Assert {
  /**
   *
   * @param {import ('./Runner.js').Runner} runner
   */
  constructor (runner) {
    this.runner = runner
  }

  async equal (expected, actual, message, debug = true) {
    const expectedAddress = this.runner.upserter.upsert(expected)
    const actualAddress = this.runner.upserter.upsert(actual)
    if (expectedAddress === actualAddress) {
      message ??= 'expected === actual'
      this.runner.appendChild(message, () => {
        return { expectedAddress, actualAddress }
      }, 'equal')
    } else {
      message ??= 'expected !== actual'
      this.runner.appendChild(message, () => {
        if (debug) {
          console.log(message)
          printDiff(this.runner.upserter, expectedAddress, actualAddress, '  ')
        }
        throw new Error(message, { cause: { expectedAddress, actualAddress } })
      }, 'not equal')
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
