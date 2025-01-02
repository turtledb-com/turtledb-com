import { globalRunner, urlToName } from '../../test/Runner.js'
import { Peer } from './Peer.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('encodes and decodes', async ({ assert }) => {
    const peerA = new Peer('a')
    const peerB = new Peer('b')
    peerB.connect(peerA.makeConnection())
    peerA.upsert({ a: 1, b: 2 })
    await new Promise(resolve => setTimeout(resolve))
    assert.equal(peerB.remote.lookup(), { a: 1, b: 2 })
    peerB.upsert('asdf1234')
    await new Promise(resolve => setTimeout(resolve, 1000))
    assert.equal(peerA.remote.lookup(), 'asdf1234')
  })
})
