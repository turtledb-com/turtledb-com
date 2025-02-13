import { globalRunner, urlToName } from '../../../test/Runner.js'
import { Peer } from './Peer.js'
import { TurtleDictionary } from '../TurtleDictionary.js'
import { EchoConnection } from './EchoConnection.js'
import { Signer } from '../Signer.js'

const tics = async count => {
  while (count--) {
    await new Promise(resolve => setTimeout(resolve))
  }
}

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('handles moving branches', async ({ assert }) => {
    const peerA = new Peer('a')
    const peerB = new Peer('b')
    const connectionAB = new EchoConnection('connectionAB', peerA)
    peerA.connections.push(connectionAB)
    const connectionBA = new EchoConnection('connectionBA', peerB, connectionAB.duplex)
    peerB.connections.push(connectionBA)
    const dictionaryA = new TurtleDictionary('aaa', peerA.recaller)
    const branchA = peerA.getBranch('aaa')
    dictionaryA.upsert('abcd')
    branchA.u8aTurtle = dictionaryA.u8aTurtle
    await tics(1) // number of tics found through trial and error (TODO: better visibility)
    const peerBSubAValue = peerB.getBranch('aaa').lookup()
    assert.equal(peerBSubAValue, 'abcd')
  })
  suite.it('handles conflicted branches', async ({ assert }) => {
    const peerOrigin = new Peer('origin')

    const peerA = new Peer('a')
    const connectionOriginA = new EchoConnection('origin-from-A', peerOrigin, undefined, true)
    peerOrigin.connections.push(connectionOriginA)
    const connectionAOrigin = new EchoConnection('origin-to-A', peerA, connectionOriginA.duplex)
    peerA.connections.push(connectionAOrigin)

    const peerB = new Peer('b')
    const connectionOriginB = new EchoConnection('origin-from-B', peerOrigin, undefined, true)
    peerOrigin.connections.push(connectionOriginB)
    const connectionBOrigin = new EchoConnection('origin-to-B', peerB, connectionOriginB.duplex)
    peerB.connections.push(connectionBOrigin)

    const signer = new Signer('user', 'secret')

    const originWorkspace = await peerOrigin.getWorkspace(signer, 'originWorkspace')
    await tics(8) // tics needed found through trial and error (TODO: better visibility)
    console.log('\n\n--- origin commit follow')
    await originWorkspace.commit(1, 'commit 1')
    await tics(2) // tics needed found through trial and error (TODO: better visibility)
    console.log('\n\n--- origin commit done?')
    const aWorkspace = await peerA.getWorkspace(signer, 'originWorkspace')
    console.log(aWorkspace.lastCommitValue)
    const bWorkspace = await peerB.getWorkspace(signer, 'originWorkspace')
    console.log(bWorkspace.lastCommitValue)
    assert.equal(aWorkspace.lastCommit, bWorkspace.lastCommit)

    await Promise.all([
      aWorkspace.commit('a', 'commit 2'),
      bWorkspace.commit('b', 'commit 2')
    ])
    console.log(originWorkspace.lastCommitValue)
    await tics(8) // number of tics found through trial and error (TODO: better visibility)
    console.log(originWorkspace.lastCommitValue)
    console.log(aWorkspace.lastCommitValue)
    console.log(bWorkspace.lastCommitValue)
  })
})
