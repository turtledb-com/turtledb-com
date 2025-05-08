import { NestedSet } from './NestedSet.js'
import { globalTestRunner, urlToName } from './TestRunner.js'

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('adds, gets values, and calculates size', ({ assert }) => {
    const nestedSet = new NestedSet()
    nestedSet.add(1, 2, 3)
    nestedSet.add(1, 2, 3, 3)
    nestedSet.add(1, 4, 3)
    nestedSet.add(1, 4, 4)
    nestedSet.add(2, 2, 5)
    nestedSet.add(3, 2, 3)

    const nestedSetCopy = new NestedSet(nestedSet.asObject)
    assert.equal(nestedSetCopy, nestedSet)

    assert.equal(nestedSet.size, 3)
    assert.equal(nestedSet.values(), [3, 4, 5])
    assert.equal(nestedSet.values(1), [3, 4])
    assert.equal(nestedSet.values(1, 2), [3])
    assert.equal(nestedSet.values(1, 2, 3), [3])
    assert.equal(nestedSet.values(2), [5])

    nestedSet.delete(1, 2, 3)
    assert.equal(nestedSet.values(), [3, 4, 5])
    assert.equal(nestedSet.values(1, 2), [])
    nestedSet.delete(1, 3)
    assert.equal(nestedSet.values(1), [4])
  })
})
