import { globalRunner, urlToName } from '../../../test/Runner.js'
import { Peer } from './Peer.js'
import { EchoConnection } from './EchoConnection.js'
import { Signer } from '../Signer.js'

const tics = async (count, ticLabel = '') => {
  for (let i = 0; i < count; ++i) {
    if (ticLabel) console.log(`${ticLabel}, tic: ${i}`)
    await new Promise(resolve => setTimeout(resolve))
  }
}

globalRunner.describe(urlToName(import.meta.url), suite => {
  const signer = new Signer('testuser', 'secret')
  suite.it('handles moving branches', async ({ assert }) => {
    const peerA = new Peer('a')
    const peerB = new Peer('b')
    const connectionAB = new EchoConnection('A-TO-B', peerA)
    const connectionBA = new EchoConnection('b-to-a', peerB, false, connectionAB.duplex)
    const aWorkspace = await peerA.getWorkspace('simpleWorkspace', signer)
    // aWorkspace.recaller.debug = true
    await aWorkspace.commit('abcd')
    await tics(4) // tics needed found through trial and error (TODO: better visibility)
    // aWorkspace.recaller.debug = false
    const bWorkspace = await peerA.getWorkspace('simpleWorkspace', signer)
    assert.equal(bWorkspace.lastCommitValue, 'abcd')
  })

  suite.it('rejects incorrectly signed commits', async ({ assert }) => {
    const peerA = new Peer('a')
    const aWorkspace = await peerA.getWorkspace('simpleWorkspace', signer)
    await aWorkspace.commit('first value', 'first commit message')
    const peerB = new Peer('b')
    const connectionAB = new EchoConnection('A-TO-SHIFTY_B', peerA)
    const connectionBA = new EchoConnection('shifty_b-to-a', peerB, false, connectionAB.duplex)
    // const badSigner = new Signer('testuser', '1234')
    const aBadWorkspace = await peerA.getWorkspace('simpleWorkspace', signer)
    // aBadWorkspace.signer = badSigner
    await aBadWorkspace.commit('xxx', 'bad commit')
  })

  suite.it('handles conflicted branches', async ({ assert }) => {
    await tics(60, ',,')
    const peerOrigin = new Peer('origin')

    const peerA = new Peer('a')
    const connectionOriginA = new EchoConnection('ORIGIN-TO-A', peerOrigin, true)
    const connectionAOrigin = new EchoConnection('A-TO-ORIGIN', peerA, false, connectionOriginA.duplex)

    const peerB = new Peer('b')
    const connectionOriginB = new EchoConnection('origin-to-b', peerOrigin, true)
    const connectionBOrigin = new EchoConnection('b-to-origin', peerB, false, connectionOriginB.duplex)

    // peerOrigin.recaller.debug = true
    const originWorkspace = await peerOrigin.getWorkspace('conflictedWorkspace', signer)
    await tics(4, '\n ---- waiting originWorkspace')
    // peerOrigin.recaller.debug = false

    await originWorkspace.commit(1, 'commit 1')
    await tics(2, '\n ---- awaiting 1st commit')
    const aWorkspace = await peerA.getWorkspace('conflictedWorkspace', signer)
    const bWorkspace = await peerB.getWorkspace('conflictedWorkspace', signer)
    assert.equal(originWorkspace.lastCommit, aWorkspace.lastCommit)
    assert.equal(aWorkspace.lastCommit, bWorkspace.lastCommit)
    await tics(60, ',,')

    await Promise.all([
      aWorkspace.commit('a', 'commit 2'),
      bWorkspace.commit('BEE', '2nd commit (#2)')
    ])
    await tics(8) // tics needed found through trial and error (TODO: better visibility)
    await tics(8, '\n ---- awaiting conflicting commits')
    assert.equal(originWorkspace.lastCommitValue, 'a')
    assert.equal(aWorkspace.lastCommitValue, 'a')
    assert.equal(bWorkspace.lastCommitValue, 'a')
  })
})
