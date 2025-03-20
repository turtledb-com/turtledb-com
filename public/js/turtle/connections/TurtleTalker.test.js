import { globalRunner, urlToName } from '../../../test/Runner.js'
import { tics } from '../../utils/nextTick.js'
import { Signer } from '../Signer.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { Workspace } from '../Workspace.js'
import { TurtleBranchTurtleTalker } from './TurtleTalker.js'

globalRunner.only.describe(urlToName(import.meta.url), suite => {
  suite.it('syncs SimpleAsyncTurtleBranch', async ({ assert }) => {
    const signer = new Signer('test-user', 'p@$$w0rd')
    const aWorkspace = new Workspace('test', signer)
    const keys = await signer.makeKeysFor(aWorkspace.name)
    const aTalker = new TurtleBranchTurtleTalker('aTalker', aWorkspace.committedBranch)
    assert.assert(aTalker)
    const b = new TurtleBranch('b')
    const bTalker = new TurtleBranchTurtleTalker('bTalker', b)

    aTalker.connect(bTalker)
    aTalker.start()
    bTalker.start()

    await tics(1) // , 'talkers icebreaking')

    await aWorkspace.commit(42, 'test commit')
    await tics(2) // , 'a sending, b updating')

    console.log(b.lookup())
  })
})
