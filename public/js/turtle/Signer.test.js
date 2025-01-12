import { globalRunner, urlToName } from '../../test/Runner.js'
import { Signer, verifyTurtleCommit } from './Signer.js'
import { TurtleBranch } from './TurtleBranch.js'
import { TurtleDictionary } from './TurtleDictionary.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('handles moving branches', async ({ assert }) => {
    const commits = new TurtleBranch('commits')
    const workspace = new TurtleDictionary('branch', undefined, commits.u8aTurtle)
    const value = { strings: ['test', 'commit'] }
    const address = workspace.upsert(value)
    const identity = new Signer('admin', 'secret')
    const keys = await identity.makeKeysFor(commits.name)
    await identity.commit(commits, workspace, address)
    const verified = await verifyTurtleCommit(commits.u8aTurtle, keys.publicKey)
    assert.equal(verified, true)
  })
})
