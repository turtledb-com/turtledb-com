import { globalRunner, urlToName } from '../../test/Runner.js'
import { combineTurtles, U8aTurtle } from './U8aTurtle.js'

globalRunner.only.describe(urlToName(import.meta.url), suite => {
  suite.it('constructs correctly', ({ assert }) => {
    console.log('running suite')
    const a = new U8aTurtle(new Uint8Array([0, 1, 2, 3]))
    assert.equal(a.height, 0, 'a.height')
    assert.equal(a.length, 4, 'a.length')

    const b = new U8aTurtle(new Uint8Array([4, 5, 6, 7]), a)
    assert.equal(b.height, 1, 'b.height')
    assert.equal(b.length, 8, 'b.length')

    assert.equal(b.findParentByAddress(1), a, 'a is correct b.parent')
    assert.equal(b.findParentByHeight(0), a, 'a is correct b.parent')
    assert.equal(b.getByte(6), 6, '6th byte is 6')
    assert.throw(() => {
      b.getByte(2)
    }, 'no out of range bytes')

    const c = new U8aTurtle(new Uint8Array([8, 9]), b)
    assert.equal(c.findParentByAddress(1), a, 'a is correct c.parent')
    assert.equal(c.findParentByHeight(0), a, 'a is correct c.parent')
    assert.equal(c.findParentByAddress(6).getByte(6), 6, '6th byte is 6')

    assert.equal(b.slice(4, 7), new Uint8Array([4, 5, 6]))
    assert.equal(b.slice(4), new Uint8Array([4, 5, 6, 7]))
    assert.equal(b.slice(-3, -2), new Uint8Array([5]))

    let head = c
    for (let i = 0; i < 10; ++i) {
      head = new U8aTurtle(new Uint8Array(), head)
    }

    assert.equal(combineTurtles(head).uint8Array, new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))
    assert.equal(combineTurtles(head, 1).uint8Array, new Uint8Array([4, 5, 6, 7, 8, 9]))
  })
})
