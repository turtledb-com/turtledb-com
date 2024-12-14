import { globalRunner, urlToName } from '../../test/Runner.js'
import { combineUint8ArrayLikes, combineUint8Arrays, zabacaba } from './utils.js'

globalRunner.only.describe(urlToName(import.meta.url), suite => {
  suite.it('returns expected values for a zabacaba function', ({ assert }) => {
    const expectedResults = [
      0,
      1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 5,
      1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 6,
      1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 5,
      1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 7,
      1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 5
    ]
    for (let i = 0; i < expectedResults.length; ++i) {
      const expected = expectedResults[i]
      const actual = zabacaba(i)
      assert.equal(actual, expected, `zabacaba(${i}) expected: ${expected}, actual: ${actual}`)
    }
  })
  suite.it('combines uint8Arrays', ({ assert }) => {
    assert.equal(new Uint8Array([1, 2, 3, 4, 5, 6]), combineUint8Arrays([
      new Uint8Array([1]),
      new Uint8Array([2, 3]),
      new Uint8Array([]),
      new Uint8Array([4, 5, 6])
    ]))
  })
  suite.it('combines uint8ArrayLikes', ({ assert }) => {
    assert.equal(new Uint8Array([1, 2, 3, 4, 5, 6]), combineUint8ArrayLikes([
      1,
      new Uint16Array((new Uint8Array([2, 3])).buffer),
      new Uint8Array([]),
      new Uint8Array([4, 5, 6])
    ]))
  })
})
