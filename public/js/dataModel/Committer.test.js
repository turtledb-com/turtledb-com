import { globalRunner, urlToName } from '../../test/Runner.js'
import { hashNameAndPassword } from '../utils/crypto.js'
import { Committer, b64ToUi8, ui8ToB64 } from './Committer.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('creates signed commits that can be verified', async ({ assert }) => {
    const hashwordA = await hashNameAndPassword('test-user-a', 'password-a')
    const privateKeyA = await hashNameAndPassword('test-repo', hashwordA)
    const committerA = new Committer('test-repo', privateKeyA)
    const publicKeyA = committerA.compactPublicKey
    let lastSignedCommitA = new Uint8Array()

    const hashwordB = await hashNameAndPassword('test-user-b', 'password-b')
    const privateKeyB = await hashNameAndPassword('test-repo', hashwordB)
    const committerB = new Committer('test-repo', privateKeyB)
    const publicKeyB = committerB.compactPublicKey
    let lastSignedCommitB = new Uint8Array()

    for (let i = 0; i < 10; ++i) {
      const signedCommitA = await committerA.commit(`commit #${i}`, i)
      const newSignedLengthA = await Committer.verifySignedCommit(signedCommitA, lastSignedCommitA, publicKeyA)
      assert.isAbove(newSignedLengthA, 0)
      assert.equal(await Committer.verifySignedCommit(signedCommitA, lastSignedCommitA, publicKeyB), undefined)
      lastSignedCommitA = signedCommitA

      const signedCommitB = await committerB.commit(`commit #${i}`, i)
      const newSignedLengthB = await Committer.verifySignedCommit(signedCommitB, lastSignedCommitB, publicKeyB)
      assert.isAbove(newSignedLengthB, 0)
      assert.equal(await Committer.verifySignedCommit(signedCommitB, lastSignedCommitB, publicKeyA), undefined)
      lastSignedCommitB = signedCommitB
    }
  }).timeout(5000)
  suite.it('converts Uint8Arrays to and from base64', ({ assert }) => {
    const ui8 = new Uint8Array(0x201).map((_, i) => i % 0x100)
    const b64 = ui8ToB64(ui8)
    assert.equal(b64ToUi8(b64), ui8)
  })
})
