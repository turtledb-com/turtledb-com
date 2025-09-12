import { globalTestRunner, urlToName } from '../utils/TestRunner.js'
import { findCommonAncestor, fromUint8Arrays, squashTurtle, U8aTurtle } from './U8aTurtle.js'

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('constructs correctly', ({ assert }) => {
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

    assert.equal(findCommonAncestor(a, b), a)
    assert.equal(findCommonAncestor(a, c), a)
    assert.equal(findCommonAncestor(b, c), b)

    const d = new U8aTurtle(new Uint8Array([8, 9]), b)
    assert.equal(findCommonAncestor(d, c), b)
  })
  suite.it('clones from exported Uint8Arrays', ({ assert }) => {
    let u8aTurtle = new U8aTurtle(new Uint8Array([0, 1, 2]))
    u8aTurtle = new U8aTurtle(new Uint8Array([3, 4, 5]), u8aTurtle)
    u8aTurtle = new U8aTurtle(new Uint8Array([6, 7]), u8aTurtle)
    const copy = fromUint8Arrays(u8aTurtle.exportUint8Arrays())
    const clone = u8aTurtle.clone()
    assert.equal(u8aTurtle.exportUint8Arrays(), copy.exportUint8Arrays())
    assert.equal(u8aTurtle.exportUint8Arrays(), clone.exportUint8Arrays())
    copy.parent.uint8Array[1] = 9
    assert.equal(u8aTurtle.exportUint8Arrays(), copy.exportUint8Arrays())
    assert.notEqual(u8aTurtle.exportUint8Arrays(), clone.exportUint8Arrays())
  })
})
