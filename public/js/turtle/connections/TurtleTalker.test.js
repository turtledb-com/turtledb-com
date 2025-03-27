import { globalRunner, urlToName } from '../../../test/Runner.js'
import { tics } from '../../utils/nextTick.js'
import { Signer } from '../Signer.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { Workspace } from '../Workspace.js'
import { TurtleBranchTurtleTalker } from './TurtleTalker.js'

globalRunner.only.describe(urlToName(import.meta.url), suite => {
  suite.it('syncs SimpleAsyncTurtleBranch', async ({ assert }) => {
    const commitSettle = async () => {
      // console.log(' -- commit settle')
      await tics(9) // , 'a sending, b verifying and updating')
    }
    const signer = new Signer('test-user', 'p@$$w0rd')
    const aWorkspace = new Workspace('test', signer)
    const keys = await signer.makeKeysFor(aWorkspace.name)
    const aTalker = new TurtleBranchTurtleTalker('aTalker', aWorkspace.committedBranch)
    const b = new TurtleBranch('b')
    const bTalker = new TurtleBranchTurtleTalker('bTalker', b, keys.publicKey)

    aTalker.connect(bTalker)
    aTalker.start()
    bTalker.start()
    await tics(1) // , 'talkers icebreaking')

    await aWorkspace.commit(42, 'everything')
    await commitSettle()
    assert.equal(b.lookup()?.value?.value, 42)

    await aWorkspace.commit(Math.E, 'euler')
    await commitSettle()
    assert.equal(b.lookup()?.value?.value, Math.E)

    await aWorkspace.commit(Math.PI, 'pi')
    await commitSettle()
    assert.equal(b.lookup()?.value?.value, Math.PI)

    const unbrokenBranch = new TurtleBranch('unbroken', undefined, aWorkspace.committedBranch.u8aTurtle)

    const brokenWorkspace = new Workspace('broken', signer, aWorkspace.committedBranch)
    // const brokenKeys = await signer.makeKeysFor(brokenWorkspace.name)
    await brokenWorkspace.commit(2, 'two')
    await commitSettle()
    assert.equal(b.lookup()?.value?.value, Math.PI)

    const unbrokenWorkspace = new Workspace('test', signer, unbrokenBranch)
    await unbrokenWorkspace.commit(4, 'four')
    aTalker.turtleBranch.u8aTurtle = unbrokenWorkspace.u8aTurtle
    await commitSettle()
    assert.equal(b.lookup()?.value?.value, 4)
  })
})
