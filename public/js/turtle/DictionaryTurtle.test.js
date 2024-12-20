import { globalRunner, urlToName } from '../../test/Runner.js'
import { DictionaryTurtle } from './DictionaryTurtle.js'

globalRunner.only.describe(urlToName(import.meta.url), suite => {
  suite.it('encodes and decodes', ({ assert }) => {
    const dictionaryTurtle = new DictionaryTurtle('codec test')
    const values = [
      undefined,
      null,
      true,
      false,
      12.4,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      new Uint8Array([1, 2]),
      new Uint8Array([9, 8, 7]),
      new Uint8Array([]),
      new Uint8Array([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111]),
      [],
      [1],
      [[[1]]],
      [[[]]],
      [1, 2, 3, 4, 5],
      new Uint16Array([1, 2, 3])
    ]
    for (const value of values) {
      // console.log('value', value)
      const address = dictionaryTurtle.upsert(value)
      // console.log('address', address)
      const recovered = dictionaryTurtle.lookup(address)
      // console.log('recovered', recovered)
      assert.equal(recovered, value, `decoded value (${recovered}) should equal original value (${value})`)
    }
  })
})
