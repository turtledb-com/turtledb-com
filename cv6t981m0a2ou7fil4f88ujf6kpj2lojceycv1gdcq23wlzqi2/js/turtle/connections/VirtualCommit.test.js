import { globalRunner, urlToName } from '../../../test/Runner.js'
import { Signer } from '../Signer.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { Workspace } from '../Workspace.js'
import { OpaqueUint8ArrayStorage } from './OpaqueUint8ArrayStorage.js'
import { VirtualCommits } from './VirtualCommits.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('gets and sets Uint8Arrays', async ({ assert }) => {
    const committedBranch = new TurtleBranch('committedBranch')
    const storage = OpaqueUint8ArrayStorage.fromTurtleBranch(committedBranch)
    const signer = new Signer('user', 'pass')
    const workspace = new Workspace('vcWorkspace', signer, committedBranch)
    const virtualCommits = new VirtualCommits(storage)

    await workspace.commit(123, '1st commit')
    await virtualCommits.setUint8Array(workspace.index, workspace.u8aTurtle.uint8Array)
    await workspace.commit('456', '2nd commit')
    await virtualCommits.setUint8Array(workspace.index, workspace.u8aTurtle.uint8Array)

    assert.equal(virtualCommits.commitsAsRefs, [,,])
    await virtualCommits.showRefs(1)
    console.log(virtualCommits.commitsAsRefs)
    console.log(await virtualCommits.getHead(1))
    console.log(workspace.lookup())
  })
})
