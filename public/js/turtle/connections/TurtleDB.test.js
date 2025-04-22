import { globalRunner, urlToName } from '../../../test/Runner.js'
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
    assert.equal(branchA.name, 'Aa')
    assert.equal(branchA.x, 1)
  })
  suite.it('filters by tag', async ({ assert }) => {
    const turtleDB = new TurtleDB('test1')
    await turtleDB.getTurtleBranch('a')
    turtleDB.getTurtleBranchInfo('a').tags.add('x')
    await turtleDB.getTurtleBranch('b')
    await turtleDB.getTurtleBranch('c')
    turtleDB.getTurtleBranchInfo('c').tags.add('x')
    const allKeys = turtleDB.getPublicKeys()
    assert.equal(allKeys, ['a', 'b', 'c'])
    const xKeys = turtleDB.getPublicKeys(new Set(['x']))
    assert.equal(xKeys, ['a', 'c'])
  })
})
