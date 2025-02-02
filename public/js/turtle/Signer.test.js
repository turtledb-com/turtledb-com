import { globalRunner, urlToName } from '../../test/Runner.js'
import { Signer, verifyTurtleCommit } from './Signer.js'
import { TurtleBranch } from './TurtleBranch.js'
import { Workspace } from './Workspace.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('handles moving branches', async ({ assert }) => {
    const commits = new TurtleBranch('commits')
    const signer = new Signer('admin', 'secret')
    const keys = await signer.makeKeysFor(commits.name)
    const workspace = new Workspace(signer, 'branch', commits)
    const value = { strings: ['test', 'commit'] }
    await workspace.commit(value, 'commit message')
    const verified = await verifyTurtleCommit(commits.u8aTurtle, keys.publicKey)
    assert.equal(verified, true)
    assert.equal(workspace.lastCommit.message, 'commit message')
    assert.equal(workspace.lastCommitValue, value)
  })
})
