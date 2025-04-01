import { globalRunner, urlToName } from '../../../test/Runner.js'
import { tics } from '../../utils/nextTick.js'
import { Signer } from '../Signer.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { Workspace } from '../Workspace.js'
import { TurtleBranchTurtleTalker } from './TurtleTalker.js'

const commitSettle = async () => {
  // console.log(' -- commit settle')
  await tics(10) // , 'a sending, b verifying and updating')
}

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('syncs SimpleAsyncTurtleBranch', async ({ assert }) => {
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

    const a2 = new TurtleBranch('a2', undefined, aWorkspace.committedBranch.u8aTurtle)
    const a2Workspace = new Workspace('test', signer, a2)
    const aTalker2 = new TurtleBranchTurtleTalker('aTalker2', a2)
    const b2 = new TurtleBranch('b2', undefined, b.u8aTurtle)
    const bTalker2 = new TurtleBranchTurtleTalker('bTalker2', b2, keys.publicKey)
    aTalker2.connect(bTalker2)
    aTalker2.start()
    bTalker2.start()
    await tics(1) //, 'talkers icebreaking')
    assert.equal(b2.lookup()?.value?.value, 4)
    assert.isAbove(b2.length, bTalker2.outgoingBranch.length) // we have more data than we received

    a2Workspace.commit(5, 'five')
    await commitSettle()
    assert.equal(b2.lookup()?.value?.value, 5)
    assert.isAbove(b2.length, bTalker2.outgoingBranch.length) // we have more data than we received from this connection
  })

  suite.it('handles bigger changes', async ({ assert }) => {
    const signer = new Signer('username', 'password')
    const aWorkspace = new Workspace('test', signer)
    const keys = await signer.makeKeysFor(aWorkspace.name)
    await aWorkspace.commit(1, 'one')
    await aWorkspace.commit(2, 'two')
    await aWorkspace.commit(3, 'three')
    const clone = new TurtleBranch('clone', undefined, aWorkspace.u8aTurtle.clone())

    const originalTalker = new TurtleBranchTurtleTalker('originalTalker', aWorkspace.committedBranch, keys.publicKey, true)
    const cloneTalker = new TurtleBranchTurtleTalker('cloneTalker', clone, keys.publicKey)

    cloneTalker.connect(originalTalker)
    await commitSettle()
    originalTalker.start()
    cloneTalker.start()
    await commitSettle()
    assert.equal(originalTalker.turtleBranch.lookup(), cloneTalker.turtleBranch.lookup())
    await aWorkspace.commit(4, 'four')
    await commitSettle()
    assert.equal(originalTalker.turtleBranch.lookup(), cloneTalker.turtleBranch.lookup())

    const bWorkspace = new Workspace('test', signer)
    await bWorkspace.commit(5, 'five')
    await bWorkspace.commit(6, 'six')
    await bWorkspace.commit(7, 'seven')
    originalTalker.turtleBranch.u8aTurtle = bWorkspace.u8aTurtle
    await commitSettle()
    assert.equal(originalTalker.turtleBranch.lookup(), cloneTalker.turtleBranch.lookup())
  })
})
