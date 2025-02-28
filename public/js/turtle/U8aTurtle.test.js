import { globalRunner, urlToName } from '../../test/Runner.js'
import { squashTurtle, U8aTurtle } from './U8aTurtle.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('constructs correctly', ({ assert }) => {
    console.log('running suite')
    const a = new U8aTurtle(new Uint8Array([0, 1, 2, 3]))
    assert.equal(a.index, 0, 'a.index')
    assert.equal(a.length, 4, 'a.length')

    const b = new U8aTurtle(new Uint8Array([4, 5, 6, 7]), a)
    assert.equal(b.index, 1, 'b.index')
    assert.equal(b.length, 8, 'b.length')

    assert.equal(b.getAncestorByAddress(1), a, 'a is correct b.parent')
    assert.equal(b.getAncestorByIndex(0), a, 'a is correct b.parent')
    assert.equal(b.getByte(6), 6, '6th byte is 6')
    assert.equal(b.getByte(7), 7, '7th byte is 7')
    assert.equal(b.getByte(), 7, 'last byte is 7')
    assert.throw(() => {
      b.getByte(2)
    }, 'no out of range bytes')

    const c = new U8aTurtle(new Uint8Array([8, 9]), b)
    assert.equal(c.getAncestorByAddress(1), a, 'a is correct c.parent')
    assert.equal(c.getAncestorByIndex(0), a, 'a is correct c.parent')
    assert.equal(c.getAncestorByAddress(6).getByte(6), 6, '6th byte is 6')

    assert.equal(b.slice(7, 8), new Uint8Array([7]))
    assert.equal(b.slice(4, 7), new Uint8Array([4, 5, 6]))
    assert.equal(b.slice(4), new Uint8Array([4, 5, 6, 7]))
    assert.equal(b.slice(-3, -2), new Uint8Array([5]))

    let head = c
    for (let i = 0; i < 10; ++i) {
      head = new U8aTurtle(new Uint8Array(), head)
    }

    assert.equal(squashTurtle(head).uint8Array, new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))
    assert.equal(squashTurtle(head, 1).uint8Array, new Uint8Array([4, 5, 6, 7, 8, 9]))
  })
})
