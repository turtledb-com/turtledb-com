import { globalRunner, urlToName } from '../../test/Runner.js'
import { handleNextTick } from '../utils/nextTick.js'
import { U8aTurtleBranch } from './U8aTurtleBranch.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('passes through U8aTurtle changes', ({ assert }) => {
    const branch = new U8aTurtleBranch('branch')
    const heights = []
    branch.recaller.watch('heights', () => {
      heights.push(branch.height)
    })
    assert.equal(heights, [undefined])
    branch.append(new Uint8Array([0, 1, 2]))
    handleNextTick()
    assert.equal(heights, [undefined, 0])
    branch.append(new Uint8Array([3, 4, 5]))
    handleNextTick()
    assert.equal(heights, [undefined, 0, 1])
    branch.append(new Uint8Array([6, 7, 8]))
    handleNextTick()
    assert.equal(heights, [undefined, 0, 1, 2])
    branch.squash(1)
    handleNextTick()
    assert.equal(heights, [undefined, 0, 1, 2, 1])
    assert.equal(branch.u8aTurtle.uint8Array, new Uint8Array([3, 4, 5, 6, 7, 8]))
  })
})
