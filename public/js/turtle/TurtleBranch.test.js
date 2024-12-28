import { globalRunner, urlToName } from '../../test/Runner.js'
import { handleNextTick } from '../utils/nextTick.js'
import { TurtleBranch } from './TurtleBranch.js'

globalRunner.only.describe(urlToName(import.meta.url), suite => {
  suite.it('passes through U8aTurtle changes', ({ assert }) => {
    const branch = new TurtleBranch('branch')
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
  suite.it('streams', async ({ assert }) => {
    const primary = new TurtleBranch('primary')
    const secondary = new TurtleBranch('secondary')
    const readableStream = primary.makeReadableStream()
    const writableStream = secondary.makeWritableStream()
    readableStream.pipeTo(writableStream)
    primary.append(new Uint8Array([1, 2, 3]))
    await new Promise(resolve => setTimeout(resolve))
    console.log(secondary.u8aTurtle.exportUint8Arrays())
  })
})
