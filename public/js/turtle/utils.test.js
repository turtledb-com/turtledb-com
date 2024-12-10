import { globalRunner, urlToName } from '../../test/Runner.js'
import { zabacaba } from './utils.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
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
      assert.equal(actual, expected, `zabacaba(${i})`)
    }
  })
})
