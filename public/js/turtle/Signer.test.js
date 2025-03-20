import { globalRunner, urlToName } from '../../test/Runner.js'
import { Signer, verifyTurtleCommit } from './Signer.js'
import { squashTurtle, U8aTurtle } from './U8aTurtle.js'
import { OPAQUE_UINT8ARRAY } from './codecs/codec.js'

globalRunner.only.describe(urlToName(import.meta.url), suite => {
  suite.it('signs and verifies commits', async ({ assert }) => {
    const signer = new Signer('signer1', 'password1')
    const name = 'branch1'
    const u8Array = new Uint8Array([1, 2, 3])
    let u8aTurtle = new U8aTurtle(OPAQUE_UINT8ARRAY.encode(u8Array))
    const u8aAddress = u8aTurtle.length - 1
    const signedCommit = await signer.signCommit(name, u8aAddress, u8aTurtle)

    u8aTurtle = new U8aTurtle(signedCommit, u8aTurtle)
    u8aTurtle = squashTurtle(u8aTurtle, 0)
    console.log(u8aTurtle.lookup())
    const committedTurtle = u8aTurtle
    assert.equal(committedTurtle.lookup().value, u8Array)
    const keys = await signer.makeKeysFor(name)
    const verification = await verifyTurtleCommit(committedTurtle, keys.publicKey)
    assert.assert(verification)

    const u8Array2 = new Uint8Array([4, 5, 6, 7])
    u8aTurtle = new U8aTurtle(OPAQUE_UINT8ARRAY.encode(u8Array2), u8aTurtle)
    const u8aAddress2 = u8aTurtle.length - 1
    const signedCommit2 = await signer.signCommit(name, u8aAddress2, u8aTurtle, committedTurtle)
    u8aTurtle = new U8aTurtle(signedCommit2, u8aTurtle)
    u8aTurtle = squashTurtle(u8aTurtle, committedTurtle.index + 1)
    assert.equal(u8aTurtle.lookup().value, u8Array2)
    const verification2 = await verifyTurtleCommit(u8aTurtle, keys.publicKey)
    assert.assert(verification2)
  })
})
