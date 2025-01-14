import { globalRunner, urlToName } from '../../test/Runner.js'
import { Peer } from './Peer.js'
import { TurtleDictionary } from './TurtleDictionary.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('handles moving branches', async ({ assert }) => {
    const peerA = new Peer('a')
    const peerB = new Peer('b')
    peerB.connect(peerA.makeConnection())
    const dictionaryA = new TurtleDictionary('aaa', peerA.recaller)
    const branchA = peerA.getBranch('aaa')
    dictionaryA.upsert('abcd')
    branchA.u8aTurtle = dictionaryA.u8aTurtle
    // why 4 tics... recaller, stream, recaller, ???
    for (let i = 0; i < 4; ++i) {
      await new Promise(resolve => setTimeout(resolve))
      // console.group('after tick')
      // console.log(JSON.stringify(peerA.summary(), null, 2))
      // console.log(JSON.stringify(peerB.summary(), null, 2))
      // console.groupEnd()
    }
    const peerBSubAValue = peerB.getBranch('aaa').lookup()
    assert.equal(peerBSubAValue, 'abcd')
  })
})
