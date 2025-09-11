import { globalTestRunner, urlToName } from '../utils/TestRunner.js'
import { AS_REFS } from './codecs/CodecType.js'
import { Signer } from './Signer.js'
import { TurtleBranch } from './TurtleBranch.js'
import { Workspace } from './Workspace.js'

const tics = async (count, ticLabel = '') => {
  for (let i = 0; i < count; ++i) {
    if (ticLabel) console.log(`${ticLabel}, tic: ${i}`)
    await new Promise(resolve => setTimeout(resolve))
  }
}

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('handles commits', async ({ assert }) => {
    const signer = new Signer('test1', 'password1')
    const committedBranch1 = new TurtleBranch('committedBranch1')
    const workspace1 = new Workspace('workspace1', signer, committedBranch1.recaller, committedBranch1)
    const workspace2 = new Workspace('workspace2', signer, committedBranch1.recaller, committedBranch1)
    await workspace1.commit('abcd', 'commit 1')
    assert.notEqual(JSON.stringify(workspace1.lookup()), JSON.stringify(workspace2.lookup()))
    await tics(2)
    assert.equal(JSON.stringify(workspace1.lookup()), JSON.stringify(workspace2.lookup()))
    await workspace2.commit('qwer', 'commit 2')
    assert.notEqual(JSON.stringify(workspace1.lookup()), JSON.stringify(workspace2.lookup()))
    await tics(2)
    assert.equal(JSON.stringify(workspace1.lookup()), JSON.stringify(workspace2.lookup()))
    const string1 = 'test string 1'
    const address1 = workspace1.upsert(string1)
    await workspace1.commit({ address1 }, 'commit 1')
    await tics(2)
    assert.equal(workspace2.lookup(workspace2.lastCommitValue.address1), string1)
  })
  suite.it('handles simultanous commits', async ({ assert }) => {
    const signer = new Signer('test1', 'password1')
    const committedBranch1 = new TurtleBranch('committedBranch1')
    const workspace = new Workspace('workspace1', signer, committedBranch1.recaller, committedBranch1)
    await Promise.all([
      workspace.commit('one', 'commit 1'),
      workspace.commit('two', 'commit 2')
    ])
    assert.equal(workspace.index, 1)
    assert.equal(workspace.lookup().document.value, 'two')
  })
  suite.it('handles upsertFile and lookupFile', async ({ assert }) => {
    const signer = new Signer('test1', 'password1')
    const committedBranch1 = new TurtleBranch('committedBranch1')
    const workspace = new Workspace('workspace1', signer, committedBranch1.recaller, committedBranch1)
    const address1 = workspace.upsertFile('file1.txt', ['line 1', 'line 2', 'line 3'])
    await workspace.commit(address1, 'commit 1')
    assert.equal(workspace.lookupFile('file1.txt'), 'line 1\nline 2\nline 3')
    const address2 = workspace.upsertFile('file2.json', { a: 1, b: 2, c: 3 })
    const address3 = workspace.upsertFile('file3.bin', new Uint8Array([1, 2, 3, 4, 5]), address2)
    await workspace.commit(address3, 'commit 3')
    assert.equal(workspace.lookupFile('file2.json'), JSON.stringify({ a: 1, b: 2, c: 3 }, null, 2))
    assert.equal(workspace.lookupFile('file3.bin'), new Uint8Array([1, 2, 3, 4, 5]))
    const address4 = workspace.upsertFile('file1.txt', null)
    await workspace.commit(address4, 'commit 4')
    assert.equal(workspace.lookupFile('file1.txt'), undefined)
    const refs = workspace.lookup('document', 'value', AS_REFS)
    assert.equal(Object.keys(refs).length, 2)
  })
})
