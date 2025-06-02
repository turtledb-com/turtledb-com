import { handleNextTick, tics } from '../utils/nextTick.js'
import { globalTestRunner, urlToName } from '../utils/TestRunner.js'
import { TurtleBranch } from './TurtleBranch.js'

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('passes through U8aTurtle changes', ({ assert }) => {
    const branch = new TurtleBranch('branch')
    const indices = []
    branch.recaller.watch('indices', () => {
      indices.push(branch.index)
    })
    assert.equal(indices, [-1])
    branch.append(new Uint8Array([0, 1, 2]))
    handleNextTick()
    assert.equal(indices, [-1, 0])
    branch.append(new Uint8Array([3, 4, 5]))
    handleNextTick()
    assert.equal(indices, [-1, 0, 1])
    branch.append(new Uint8Array([6, 7, 8]))
    handleNextTick()
    assert.equal(indices, [-1, 0, 1, 2])
    branch.squash(1)
    handleNextTick()
    assert.equal(indices, [-1, 0, 1, 2, 1])
    assert.equal(branch.u8aTurtle.uint8Array, new Uint8Array([3, 4, 5, 6, 7, 8]))
  })
  suite.it('streams append', async ({ assert }) => {
    const primary = new TurtleBranch('primary')
    const secondary = new TurtleBranch('secondary')
    const readableStream = primary.makeReadableStream()
    const writableStream = secondary.makeWritableStream()
    readableStream.pipeTo(writableStream)
    primary.append(new Uint8Array([1, 2, 3]))
    await new Promise(resolve => setTimeout(resolve))
    assert.equal(secondary.u8aTurtle.exportUint8Arrays(), [new Uint8Array([1, 2, 3])])
  })
  suite.it('streams set u8aTurtle', async ({ assert }) => {
    const primary = new TurtleBranch('primary')
    const secondary = new TurtleBranch('secondary')
    const readableStream = primary.makeReadableStream()
    const writableStream = secondary.makeWritableStream()
    readableStream.pipeTo(writableStream)
    primary.append(new Uint8Array([1, 2, 3]))
    await new Promise(resolve => setTimeout(resolve))
    assert.equal(secondary.u8aTurtle.exportUint8Arrays(), [new Uint8Array([1, 2, 3])])

    const primaryBranched = new TurtleBranch('branched', undefined, primary.u8aTurtle)
    primaryBranched.append(new Uint8Array([4, 5, 6]))
    primaryBranched.append(new Uint8Array([7, 8, 9]))
    primary.u8aTurtle = primaryBranched.u8aTurtle
    await new Promise(resolve => setTimeout(resolve))
    assert.equal(secondary.u8aTurtle.exportUint8Arrays(), [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
      new Uint8Array([7, 8, 9])
    ])
  })
  suite.it('streams established U8aTurtles', async ({ assert }) => {
    const primary = new TurtleBranch('primary')
    primary.append(new Uint8Array([1, 2, 3]))
    primary.append(new Uint8Array([4, 5, 6]))
    primary.append(new Uint8Array([7, 8, 9]))
    const secondary = new TurtleBranch('secondary')
    primary.makeReadableStream().pipeTo(secondary.makeWritableStream())
    await tics(1)
    assert.equal(secondary.u8aTurtle.exportUint8Arrays(), [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
      new Uint8Array([7, 8, 9])
    ])
  })
  suite.it('async generators', async ({ assert }) => {
    const branch = new TurtleBranch('branch')
    branch.append(new Uint8Array([1]))
    branch.append(new Uint8Array([2]))
    const uint8Arrays = []
    ;(async () => {
      for await (const u8aTurtle of branch.u8aTurtleGenerator()) {
        uint8Arrays.push(u8aTurtle.uint8Array)
      }
    })()
    await tics(1)
    assert.equal(uint8Arrays, [new Uint8Array([1]), new Uint8Array([2])])
    branch.append(new Uint8Array([3]))
    branch.append(new Uint8Array([4]))
    await tics(1)
    assert.equal(uint8Arrays, [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3]), new Uint8Array([4])])
  })
})
