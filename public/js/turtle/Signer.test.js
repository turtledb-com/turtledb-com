import { globalTestRunner, urlToName } from '../utils/TestRunner.js'
import { Signer, verifyCommitU8a, verifyTurtleCommit } from './Signer.js'
import { squashTurtle, U8aTurtle } from './U8aTurtle.js'
import { OPAQUE_UINT8ARRAY } from './codecs/codec.js'

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('signs and verifies commits', async ({ assert }) => {
    const signer = new Signer('signer1', 'password1')
    const name = 'branch1'
    const u8Array = new Uint8Array([1, 2, 3])
    let u8aTurtle = new U8aTurtle(OPAQUE_UINT8ARRAY.encode(u8Array))
    const u8aAddress = u8aTurtle.length - 1
    const signedCommit = await signer.signCommit(name, u8aAddress, u8aTurtle)

    u8aTurtle = new U8aTurtle(signedCommit, u8aTurtle)
    u8aTurtle = squashTurtle(u8aTurtle, 0)
    const committedTurtle = u8aTurtle
    assert.equal(committedTurtle.lookup().document, u8Array)
    const keys = await signer.makeKeysFor(name)
    const verification0 = await verifyCommitU8a(keys.publicKey, u8aTurtle.getAncestorByIndex(0).uint8Array)
    assert.assert(verification0)
    const verification = await verifyTurtleCommit(committedTurtle, keys.publicKey)
    assert.assert(verification)

    const u8Array2 = new Uint8Array([4, 5, 6, 7])
    u8aTurtle = new U8aTurtle(OPAQUE_UINT8ARRAY.encode(u8Array2), u8aTurtle)
    const u8aAddress2 = u8aTurtle.length - 1
    const signedCommit2 = await signer.signCommit(name, u8aAddress2, u8aTurtle, committedTurtle)
    u8aTurtle = new U8aTurtle(signedCommit2, u8aTurtle)
    u8aTurtle = squashTurtle(u8aTurtle, committedTurtle.index + 1)
    assert.equal(u8aTurtle.lookup().document, u8Array2)
    const verification2 = await verifyTurtleCommit(u8aTurtle, keys.publicKey)
    assert.assert(verification2)

    const verification3 = await verifyCommitU8a(keys.publicKey, u8aTurtle.uint8Array, u8aTurtle.parent.uint8Array)
    assert.assert(verification3)
  })
})
