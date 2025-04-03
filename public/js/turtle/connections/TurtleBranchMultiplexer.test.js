import { globalRunner, urlToName } from '../../../test/Runner.js'
import { tics } from '../../utils/nextTick.js'
import { Signer } from '../Signer.js'
import { Workspace } from '../Workspace.js'
import { TurtleBranchMultiplexer } from './TurtleBranchMultiplexer.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('syncs multiple SimpleAsyncTurtleBranch', async ({ assert }) => {
    const signer = new Signer('username', 'password')
    const name = 'test'
    const keys = await signer.makeKeysFor(name)
    const aTBMux = new TurtleBranchMultiplexer('a', true)
    const aTBUpdater = aTBMux.getTurtleBranchUpdater('test-a', keys.publicKey)
    const aWorkspace = new Workspace(name, signer, aTBUpdater.turtleBranch)
    await aWorkspace.commit(1, 'one')

    const bTBMux = new TurtleBranchMultiplexer('b')
    const bTBUpdater = bTBMux.getTurtleBranchUpdater('test-b', keys.publicKey)

    aTBMux.connect(bTBMux)

    await tics(4)
    assert.equal(bTBUpdater.turtleBranch.lookup().document.message, 'one')
  })
})
