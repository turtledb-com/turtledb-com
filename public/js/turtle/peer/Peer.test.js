import { globalRunner, urlToName } from '../../../test/Runner.js'
import { Peer } from './Peer.js'
import { EchoConnection } from './EchoConnection.js'
import { Signer } from '../Signer.js'

const tics = async count => {
  while (count--) {
    await new Promise(resolve => setTimeout(resolve))
  }
}

globalRunner.only.describe(urlToName(import.meta.url), suite => {
  const signer = new Signer('testuser', 'secret')
  suite.it('handles moving branches', async ({ assert }) => {
    const peerA = new Peer('a')
    const peerB = new Peer('b')
    const connectionAB = new EchoConnection('a-to-b', peerA)
    peerA.connections.push(connectionAB)
    const connectionBA = new EchoConnection('b-to-a', peerB, false, connectionAB.duplex)
    peerB.connections.push(connectionBA)
    const aWorkspace = await peerA.getWorkspace(signer, 'simpleWorkspace')
    await aWorkspace.commit('abcd')
    await tics(4) // tics needed found through trial and error (TODO: better visibility)
    const bWorkspace = await peerA.getWorkspace(signer, 'simpleWorkspace')
    assert.equal(bWorkspace.lastCommitValue, 'abcd')
  })

  suite.it('handles conflicted branches', async ({ assert }) => {
    await tics(100) // tics needed found through trial and error (TODO: better visibility)
    console.log('\n\n--- waited for other tests')
    const peerOrigin = new Peer('origin')

    const peerA = new Peer('a')
    const connectionOriginA = new EchoConnection('origin-to-A', peerOrigin, true)
    peerOrigin.connections.push(connectionOriginA)
    const connectionAOrigin = new EchoConnection('A-to-origin', peerA, false, connectionOriginA.duplex)
    peerA.connections.push(connectionAOrigin)

    const peerB = new Peer('b')
    const connectionOriginB = new EchoConnection('origin-to-B', peerOrigin, true)
    peerOrigin.connections.push(connectionOriginB)
    const connectionBOrigin = new EchoConnection('B-to-origin', peerB, false, connectionOriginB.duplex)
    peerB.connections.push(connectionBOrigin)

    peerOrigin.recaller.debug = true
    const originWorkspace = await peerOrigin.getWorkspace(signer, 'conflictedWorkspace')
    await tics(8) // tics needed found through trial and error (TODO: better visibility)
    peerOrigin.recaller.debug = false

    console.log('\n\n--- initial settle')
    await originWorkspace.commit(1, 'commit 1')
    console.log('\n\n--- commit 1')
    await tics(2) // tics needed found through trial and error (TODO: better visibility)
    console.log('\n\n--- commit 1 settle')
    const aWorkspace = await peerA.getWorkspace(signer, 'conflictedWorkspace')
    console.log('aWorkspace.lastCommitValue', aWorkspace.lastCommitValue)
    const bWorkspace = await peerB.getWorkspace(signer, 'conflictedWorkspace')
    console.log('bWorkspace.lastCommitValue', bWorkspace.lastCommitValue)
    assert.equal(originWorkspace.lastCommit, aWorkspace.lastCommit)
    assert.equal(aWorkspace.lastCommit, bWorkspace.lastCommit)

    console.log('\n\n--- origin commit settle')

    await Promise.all([
      aWorkspace.commit('a', 'commit 2'),
      bWorkspace.commit('BEE', '2nd commit (#2)')
    ])
    console.log('originWorkspace.lastCommitValue', originWorkspace.lastCommitValue)
    await tics(8) // tics needed found through trial and error (TODO: better visibility)
    console.log('originWorkspace.lastCommitValue', originWorkspace.lastCommitValue)
    console.log('aWorkspace.lastCommitValue', aWorkspace.lastCommitValue)
    console.log('bWorkspace.lastCommitValue', bWorkspace.lastCommitValue)
  })
})
