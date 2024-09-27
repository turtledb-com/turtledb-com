import { NestedSet } from './NestedSet.js'

const { default: chai } = await import('./chaiPromise.test.js')

describe('NestedSet', function () {
  it('adds, gets values, and calculates size', function () {
    const nestedSet = new NestedSet()
    nestedSet.add(1, 2, 3)
    nestedSet.add(1, 2, 3, 3)
    nestedSet.add(1, 4, 3)
    nestedSet.add(1, 4, 4)
    nestedSet.add(2, 2, 5)
    nestedSet.add(3, 2, 3)

    const nestedSetCopy = new NestedSet(nestedSet.asObject)
    chai.assert.deepEqual(nestedSetCopy, nestedSet)

    chai.assert.equal(nestedSet.size, 3)
    chai.assert.deepEqual(nestedSet.values(), [3, 4, 5])
    chai.assert.deepEqual(nestedSet.values(1), [3, 4])
    chai.assert.deepEqual(nestedSet.values(1, 2), [3])
    chai.assert.deepEqual(nestedSet.values(1, 2, 3), [3])
    chai.assert.deepEqual(nestedSet.values(2), [5])

    nestedSet.delete(1, 2, 3)
    chai.assert.deepEqual(nestedSet.values(), [3, 4, 5])
    chai.assert.deepEqual(nestedSet.values(1, 2), [])
    nestedSet.delete(1, 3)
    chai.assert.deepEqual(nestedSet.values(1), [4])
  })
})
