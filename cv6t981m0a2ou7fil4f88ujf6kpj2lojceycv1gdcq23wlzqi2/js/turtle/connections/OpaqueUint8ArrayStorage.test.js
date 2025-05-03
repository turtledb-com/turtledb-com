import { globalRunner, urlToName } from '../../../test/Runner.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { OpaqueUint8ArrayStorage } from './OpaqueUint8ArrayStorage.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('stores and retrieves opaque Uint8Arrays', async ({ assert }) => {
    const turtleBranch = new TurtleBranch('turtleBranch')
    const storage = OpaqueUint8ArrayStorage.fromTurtleBranch(turtleBranch)
    const uint8Array = new Uint8Array([1, 2, 3, 4])
    const address1 = storage.upsert(uint8Array)
    const v1 = storage.lookup(address1)
    console.log({ address1, v1 })
    assert.equal(uint8Array, v1)
    const address2 = storage.upsert(uint8Array)
    assert.notEqual(address1, address2)
    const v2 = storage.lookup(address2)
    assert.equal(uint8Array, v2)
  })
})
