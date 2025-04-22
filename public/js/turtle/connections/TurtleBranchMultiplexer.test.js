import { globalRunner, urlToName } from '../../../test/Runner.js'
import { Signer } from '../Signer.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { Workspace } from '../Workspace.js'
import { TurtleBranchMultiplexer } from './TurtleBranchMultiplexer.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('syncs multiple SimpleAsyncTurtleBranch', async ({ assert }) => {
    const signer = new Signer('username', 'password')
    const name = 'test'
    const keys = await signer.makeKeysFor(name)
    const aTBMux = new TurtleBranchMultiplexer('a', true)
    const turtleBranch = new TurtleBranch('test')
    const aWorkspace = new Workspace(name, signer, turtleBranch)
    await aWorkspace.commit(1, 'one')
    await aTBMux.getTurtleBranchUpdater('test-a', keys.publicKey, turtleBranch)

    const bTBMux = new TurtleBranchMultiplexer('b')
    const bTBUpdater = bTBMux.getTurtleBranchUpdater('test-b', keys.publicKey)

    aTBMux.connect(bTBMux)

    await bTBUpdater.settle

    // console.log(bTBUpdater.turtleBranch.lookup())
    assert.equal(bTBUpdater.turtleBranch.lookup().document.message, 'one')
  })
})
