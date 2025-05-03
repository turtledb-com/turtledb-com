import { globalRunner, urlToName } from '../../test/Runner.js'
import { Signer } from './Signer.js'
import { TurtleBranch } from './TurtleBranch.js'
import { Workspace } from './Workspace.js'

const tics = async (count, ticLabel = '') => {
  for (let i = 0; i < count; ++i) {
    if (ticLabel) console.log(`${ticLabel}, tic: ${i}`)
    await new Promise(resolve => setTimeout(resolve))
  }
}

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('handles commits', async ({ assert }) => {
    const signer = new Signer('test1', 'password1')
    const committedBranch1 = new TurtleBranch('committedBranch1')
    const workspace1 = new Workspace('workspace1', signer, committedBranch1)
    const workspace2 = new Workspace('workspace2', signer, committedBranch1)
    await workspace1.commit('abcd', 'commit 1')
    assert.notEqual(workspace1.lookup(), workspace2.lookup())
    await tics(2)
    assert.equal(workspace1.lookup(), workspace2.lookup())
    await workspace2.commit('qwer', 'commit 2')
    assert.notEqual(workspace1.lookup(), workspace2.lookup())
    await tics(2)
    assert.equal(workspace1.lookup(), workspace2.lookup())
    const string1 = 'test string 1'
    const address1 = workspace1.upsert(string1)
    await workspace1.commit({ address1 }, 'commit 1')
    await tics(2)
    assert.equal(workspace2.lookup(workspace2.lastCommitValue.address1), string1)
  })
  suite.it('handles simultanous commits', async ({ assert }) => {
    const signer = new Signer('test1', 'password1')
    const committedBranch1 = new TurtleBranch('committedBranch1')
    const workspace1 = new Workspace('workspace1', signer, committedBranch1)
    await Promise.all([
      workspace1.commit('one', 'commit 1'),
      workspace1.commit('two', 'commit 2')
    ])
    console.log(workspace1.lookup())
  })
})
