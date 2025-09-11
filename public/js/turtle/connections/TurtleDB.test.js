import { tics } from '../../utils/nextTick.js'
import { globalTestRunner, urlToName } from '../../utils/TestRunner.js'
import { TurtleDB } from './TurtleDB.js'

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('correctly makes branches', async ({ assert }) => {
    const turtleDB = new TurtleDB('test1')
    turtleDB.bind(async status => {
      status.turtleBranch.x ??= []
      status.turtleBranch.x.push('a')
    })
    turtleDB.bind(async status => {
      status.turtleBranch.x ??= []
      status.turtleBranch.x.push('b')
    })
    const branchA = await turtleDB.summonBoundTurtleBranch('abc123', 'A')
    assert.equal(branchA.x, ['a', 'b'])
  })
  suite.it('filters by tag', async ({ assert }) => {
    const turtleDB = new TurtleDB('test2')
    await turtleDB.summonBoundTurtleBranch('a')
    turtleDB.getStatus('a').tags.add('x')
    await turtleDB.summonBoundTurtleBranch('b')
    await turtleDB.summonBoundTurtleBranch('c')
    turtleDB.tag('c', 'x')
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
    await turtleDB.summonBoundTurtleBranch('a')
    await turtleDB.summonBoundTurtleBranch('b')
    await tics()
    assert.equal(outputs, [[[], []], [['a', 'b'], []]])
    turtleDB.tag('a', 'x')
    await tics()
    assert.equal(outputs, [[[], []], [['a', 'b'], []], [['a', 'b'], ['a']]])
  })
})
