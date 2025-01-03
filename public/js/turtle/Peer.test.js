import { globalRunner, urlToName } from '../../test/Runner.js'
import { Peer } from './Peer.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('pipes changes', async ({ assert }) => {
    const peerA = new Peer('a')
    const peerB = new Peer('b')
    peerB.connect(peerA.makeConnection())
    peerA.connections[0].localDictionary.upsert({ a: 1, b: 2 })
    await new Promise(resolve => setTimeout(resolve))
    assert.equal(peerB.connections[0].remoteBranch.lookup(), { a: 1, b: 2 })
    peerB.connections[0].localDictionary.upsert('asdf1234')
    await new Promise(resolve => setTimeout(resolve, 1000))
    assert.equal(peerA.connections[0].remoteBranch.lookup(), 'asdf1234')
  })
})
