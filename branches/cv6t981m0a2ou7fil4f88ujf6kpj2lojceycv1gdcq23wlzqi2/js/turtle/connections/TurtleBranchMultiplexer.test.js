import { tics } from '../../utils/nextTick.js'
import { globalTestRunner, urlToName } from '../../utils/TestRunner.js'
import { Signer } from '../Signer.js'
import { Workspace } from '../Workspace.js'
import { TurtleBranchMultiplexer } from './TurtleBranchMultiplexer.js'

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('syncs multiple SimpleAsyncTurtleBranch', async ({ assert }) => {
    const signer = new Signer('username', 'password')
    const name = 'test'
    const keys = await signer.makeKeysFor(name)
    const aTBMux = new TurtleBranchMultiplexer('a', true)
    const aTBUpdater = await aTBMux.getTurtleBranchUpdater('test-a', keys.publicKey)

    const workspace = new Workspace(name, signer, aTBUpdater.turtleBranch.recaller, aTBUpdater.turtleBranch)
    await workspace.commit(1, 'one')
    await tics(1) // let the commit make it into aTBUpdater's outgoing branch (or else it will start settled at 0)

    const bTBMux = new TurtleBranchMultiplexer('b')
    const bTBUpdater = await bTBMux.getTurtleBranchUpdater('test-b', keys.publicKey)
    aTBMux.connect(bTBMux)

    await bTBUpdater.settle
    assert.equal(bTBUpdater.turtleBranch.lookup().document.message, 'one')
  })
})
