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

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('handles basic duplication', async ({ assert }) => {
    const turtlename = 'workspaceA'
    const signer = new Signer('basic', 'test')
    const keys = await signer.makeKeysFor(turtlename)
    const workspaceA = new Workspace(turtlename, signer, new TurtleBranch(keys.publicKey))

    const updateManifold1 = new UpdateManifold('basic-test-manifold_#1')
    const updateManifold2 = new UpdateManifold('basic-test-manifold_#2')
    updateManifold1.connect(updateManifold2.duplex)

    await tics(10, '\t-\t-\tupdateManifolds connected')

    const recaller1 = new Recaller('BranchUpdateRecaller #1')
    const workspaceAUpdate1 = new BranchUpdate('WSU1', updateManifold1, recaller1, false, keys.publicKey)

    await tics(10, '\t-\t-\tworkspaceAUpdate1 created')

    const recaller2 = new Recaller('BranchUpdateRecaller #2')
    const workspaceAUpdate2 = new BranchUpdate('wsu2', updateManifold2, recaller2, false, keys.publicKey)

    await tics(10, '\t-\t-\tworkspaceAUpdate2 created')

    await workspaceA.commit('1', 'a')
    await workspaceAUpdate1.setUint8Array(0, workspaceA.u8aTurtle.uint8Array)

    await tics(10, '\t-\t-\tworkspaceAUpdate1 appending commit')

    console.log(await workspaceAUpdate1.getUint8Array(0))
    console.log(await workspaceAUpdate2.getUint8Array(0))

    /*

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
    */
  })
})
