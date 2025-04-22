import { globalRunner, urlToName } from '../../../test/Runner.js'
import { tics } from '../../utils/nextTick.js'
import { TurtleDB } from './TurtleDB.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('correctly makes branches', async ({ assert }) => {
    const turtleDB = new TurtleDB('test1')
    turtleDB.addTurtleBranchStep(async (next, publicKey, name, turtleBranchSuggestion) => {
      name += 'a'
      const turtleBranch = await next(publicKey, name, turtleBranchSuggestion)
      turtleBranch.x = 1
      return turtleBranch
    })
    const branchA = await turtleDB.getTurtleBranch('abc123', 'A')
    console.log(branchA)
    assert.equal(branchA.name, 'Aa')
    assert.equal(branchA.x, 1)
  })
  suite.it('filters by tag', async ({ assert }) => {
    const turtleDB = new TurtleDB('test2')
    await turtleDB.getTurtleBranch('a')
    turtleDB.getTurtleBranchInfo('a').tags.add('x')
    await turtleDB.getTurtleBranch('b')
    await turtleDB.getTurtleBranch('c')
    turtleDB.addTag('c', 'x')
    const allKeys = turtleDB.getPublicKeys()
    assert.equal(allKeys, ['a', 'b', 'c'])
    const xKeys = turtleDB.getPublicKeys(new Set(['x']))
    assert.equal(xKeys, ['a', 'c'])
  })
  suite.it('notifies on changes', async ({ assert }) => {
    const turtleDB = new TurtleDB('test3')
    const outputs = []
    turtleDB.recaller.watch('test3', () => {
      outputs.push([turtleDB.getPublicKeys(), turtleDB.getPublicKeys(new Set(['x']))])
    })
    await turtleDB.getTurtleBranch('a')
    await turtleDB.getTurtleBranch('b')
    await tics()
    assert.equal(outputs, [[[], []], [['a', 'b'], []]])
    turtleDB.addTag('a', 'x')
    await tics()
    assert.equal(outputs, [[[], []], [['a', 'b'], []], [['a', 'b'], ['a']]])
  })
})
