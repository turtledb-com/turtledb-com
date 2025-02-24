import { globalRunner, urlToName } from '../../../test/Runner.js'
import { Recaller } from '../../utils/Recaller.js'
import { Signer } from '../Signer.js'
import { TurtleBranch } from '../TurtleBranch.js'
import { Workspace } from '../Workspace.js'
import { BranchUpdate, UpdateManifold } from './BasicConnection.js'

const tics = async (count, ticLabel = '') => {
  for (let i = 0; i < count; ++i) {
    if (ticLabel) console.log(`${ticLabel}, tic: ${i}`)
    await new Promise(resolve => setTimeout(resolve))
  }
}

globalRunner.only.describe(urlToName(import.meta.url), suite => {
  suite.it('handles basic duplication', async ({ assert }) => {
    const turtlename = 'workspaceA'
    const signer = new Signer('basic', 'test')
    const keys = await signer.makeKeysFor(turtlename)
    const workspaceA = new Workspace(signer, turtlename, new TurtleBranch(keys.publicKey))

    const recaller1 = new Recaller('BranchUpdateRecaller #1')
    const updateManifold1 = new UpdateManifold('basic test manifold #1', recaller1)
    const workspaceAUpdate1 = new BranchUpdate('WSU1', updateManifold1, recaller1, keys.publicKey)

    const recaller2 = new Recaller('BranchUpdateRecaller #2')
    const updateManifold2 = new UpdateManifold('basic test manifold #2', recaller2)
    const workspaceAUpdate2 = new BranchUpdate('wsu2', updateManifold2, recaller2, keys.publicKey)

    await workspaceAUpdate2.combine(workspaceAUpdate1)
    await workspaceAUpdate1.combine(workspaceAUpdate2)

    await workspaceA.commit('1', 'a')
    await workspaceAUpdate1.setUint8Array(0, workspaceA.u8aTurtle.uint8Array)

    await workspaceAUpdate2.combine(workspaceAUpdate1)
    await workspaceAUpdate1.combine(workspaceAUpdate2)
    await workspaceAUpdate2.combine(workspaceAUpdate1)

    await workspaceA.commit('2', 'b')
    await workspaceAUpdate1.setUint8Array(1, workspaceA.u8aTurtle.uint8Array)

    await workspaceAUpdate1.combine(workspaceAUpdate2)
    await workspaceAUpdate2.combine(workspaceAUpdate1)
    await workspaceAUpdate1.combine(workspaceAUpdate2)
  })
})
