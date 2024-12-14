import { globalRunner, urlToName } from '../../test/Runner.js'
import { U8aTurtle } from './U8aTurtle.js'

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
  })
})
