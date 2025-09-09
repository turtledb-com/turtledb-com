import { tics } from '../../utils/nextTick.js'
import { globalTestRunner, urlToName } from '../../utils/TestRunner.js'
import { Signer } from '../Signer.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { Workspace } from '../Workspace.js'
import { TurtleBranchUpdater } from './TurtleBranchUpdater.js'

const commitSettle = async () => {
  // console.log(' -- commit settle')
  await tics(10) // , 'a sending, b verifying and updating')
}

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('syncs SimpleAsyncTurtleBranch', async ({ assert }) => {
    const signer = new Signer('test-user', 'p@$$w0rd')
    const aWorkspace = new Workspace('test', signer)
    const keys = await signer.makeKeysFor(aWorkspace.name)
    const aTalker = new TurtleBranchUpdater('aTalker', aWorkspace.committedBranch, keys.publicKey)
    const b = new TurtleBranch('b')
    const bTalker = new TurtleBranchUpdater('bTalker', b, keys.publicKey, true)

    aTalker.connect(bTalker)
    aTalker.start()
    bTalker.start()
    await tics(1) // , 'talkers icebreaking')

    await aWorkspace.commit(42, 'everything', false)
    await commitSettle()
    assert.equal(b.lookup()?.document?.value, 42)

    await aWorkspace.commit(Math.E, 'euler', false)
    await commitSettle()
    assert.equal(b.lookup()?.document?.value, Math.E)

    await aWorkspace.commit(Math.PI, 'pi', false)
    await commitSettle()
    assert.equal(b.lookup()?.document?.value, Math.PI)

    const unbrokenBranch = new TurtleBranch('unbroken', undefined, aWorkspace.committedBranch.u8aTurtle)

    const brokenWorkspace = new Workspace('broken', signer, aWorkspace.committedBranch.recaller, aWorkspace.committedBranch)
    // const brokenKeys = await signer.makeKeysFor(brokenWorkspace.name)
    await brokenWorkspace.commit(2, 'two', false)
    await commitSettle()
    assert.equal(b.lookup()?.document?.value, Math.PI)

    const unbrokenWorkspace = new Workspace('test', signer, unbrokenBranch.recaller, unbrokenBranch)
    await unbrokenWorkspace.commit(4, 'four', false)
    aTalker.turtleBranch.u8aTurtle = unbrokenWorkspace.u8aTurtle
    await commitSettle()
    assert.equal(b.lookup()?.document?.value, 4)

    const a2 = new TurtleBranch('a2', undefined, aWorkspace.committedBranch.u8aTurtle)
    const a2Workspace = new Workspace('test', signer, a2.recaller, a2)
    const aTalker2 = new TurtleBranchUpdater('aTalker2', a2, keys.publicKey)
    const b2 = new TurtleBranch('b2', undefined, b.u8aTurtle)
    const bTalker2 = new TurtleBranchUpdater('bTalker2', b2, keys.publicKey)
    aTalker2.connect(bTalker2)
    aTalker2.start()
    bTalker2.start()
    await tics(1) //, 'talkers icebreaking')
    assert.equal(b2.lookup()?.document?.value, 4)
    assert.isAbove(b2.length, bTalker2.outgoingBranch.length) // we have more data than we received

    a2Workspace.commit(5, 'five', false)
    await commitSettle()
    assert.equal(b2.lookup()?.document?.value, 5)
    assert.isAbove(b2.length, bTalker2.outgoingBranch.length) // we have more data than we received from this connection
  })

  suite.it('handles bigger changes', async ({ assert }) => {
    const signer = new Signer('username', 'password')
    const aWorkspace = new Workspace('test', signer)
    const keys = await signer.makeKeysFor(aWorkspace.name)
    await aWorkspace.commit(1, 'one', false)
    await aWorkspace.commit(2, 'two', false)
    await aWorkspace.commit(3, 'three', false)
    const clone = new TurtleBranch('clone', undefined, aWorkspace.u8aTurtle.clone())

    const originalTalker = new TurtleBranchUpdater('originalTalker', aWorkspace.committedBranch, keys.publicKey, true)
    const cloneTalker = new TurtleBranchUpdater('cloneTalker', clone, keys.publicKey)

    cloneTalker.connect(originalTalker)
    await commitSettle()
    originalTalker.start()
    cloneTalker.start()
    await commitSettle()
    assert.equal(JSON.stringify(originalTalker.turtleBranch.lookup()), JSON.stringify(cloneTalker.turtleBranch.lookup()))
    await aWorkspace.commit(4, 'four', false)
    await commitSettle()
    assert.equal(JSON.stringify(originalTalker.turtleBranch.lookup()), JSON.stringify(cloneTalker.turtleBranch.lookup()))

    const bWorkspace = new Workspace('test', signer)
    await bWorkspace.commit(5, 'five', false)
    await bWorkspace.commit(6, 'six', false)
    await bWorkspace.commit(7, 'seven', false)
    originalTalker.turtleBranch.u8aTurtle = bWorkspace.u8aTurtle
    await commitSettle()
    assert.equal(JSON.stringify(originalTalker.turtleBranch.lookup()), JSON.stringify(cloneTalker.turtleBranch.lookup()))
  })
})
