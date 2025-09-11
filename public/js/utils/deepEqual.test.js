import { deepEqual } from "./deepEqual.js";
import { globalTestRunner, urlToName } from "./TestRunner.js";

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('can tell same things from different things', ({ assert }) => {
    assert.assert(deepEqual(
      new Uint8Array([1,2,3]),
      new Uint8Array([1,2,3])
    ))
    assert.assert(!deepEqual(
      new Uint8Array([1,2,3]),
      new Uint16Array([1,2,3])
    ))
    assert.assert(!deepEqual( null, undefined))
    assert.assert(deepEqual( null, null))
    assert.assert(deepEqual( undefined, undefined))
    assert.assert(deepEqual( 'asdf', 'asdf'))
    assert.assert(deepEqual(
      [new Uint8Array([1,2,3])],
      [new Uint8Array([1,2,3])]
    ))
    assert.assert(deepEqual(
      {a: 1, b: [new Uint8Array([1,2,3])]},
      {a: 1, b: [new Uint8Array([1,2,3])]}
    ))
  })
})