import { globalRunner, urlToName } from '../../test/Runner.js'
import { Committer } from '../dataModel/Committer.js'
import { Uint8ArrayLayerPointer } from '../dataModel/Uint8ArrayLayerPointer.js'
import { Recaller } from '../utils/Recaller.js'
import { hashNameAndPassword } from '../utils/crypto.js'
import { bigLabel } from '../utils/loggy.js'
import { handleNextTick } from '../utils/nextTick.js'
import { Peer, getPointerByPublicKey } from './Peer.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('more basic synchronization', async ({ assert }) => {
    const recallerA = new Recaller('recallerA')
    const peerA = new Peer('peerA', recallerA, undefined, {})
    const recallerB = new Recaller('recallerB')
    const peerB = new Peer('peerB', recallerB, undefined, {})
    recallerA.watch('send updates from A to B', () => {
      // console.log('@@@@@@@@@@@@ recallerA sending A to B: peerA.layerIndex:', peerA.layerIndex, 'peerB.remoteExports.layerIndex:', peerB.remoteExports.layerIndex)
      while (peerA.layerIndex > (peerB.remoteExports.layerIndex ?? -1)) {
        peerB.remoteExports.append(peerA.getLayerAtIndex((peerB.remoteExports.layerIndex ?? -1) + 1).uint8Array)
      }
      // console.log('@@@@@@@@@@@@ recallerA sent A to B: peerA.layerIndex:', peerA.layerIndex, 'peerB.remoteExports.layerIndex:', peerB.remoteExports.layerIndex)
    })
    recallerB.watch('send updates from B to A', () => {
      // console.log('@@@@@@@@@@@@ recallerB sending B to A: peerB.layerIndex:', peerB.layerIndex, 'peerA.remoteExports.layerIndex:', peerA.remoteExports.layerIndex)
      while ((peerB.layerIndex ?? -1) > (peerA.remoteExports.layerIndex ?? -1)) {
        peerA.remoteExports.append(peerB.getLayerAtIndex((peerA.remoteExports.layerIndex ?? -1) + 1).uint8Array)
      }
      // console.log('@@@@@@@@@@@@ recallerB sent B to A: peerB.layerIndex:', peerB.layerIndex, 'peerA.remoteExports.layerIndex:', peerA.remoteExports.layerIndex)
    })

    function whatsUp (message, assertWants, verbose = false) {
      const toWants = sourceObjects => Object.values(sourceObjects.lookup() ?? {}).map(({ want }) => want[0][0]).sort()
      const wants = {
        asw: toWants(peerA),
        arw: toWants(peerA.remoteExports),
        bsw: toWants(peerB),
        brw: toWants(peerB.remoteExports)
      }
      if (verbose) {
        bigLabel(JSON.stringify(message), () => {
          console.dir(wants, { depth: 5 })
          console.group('peerA')
          console.group('sourceExports')
          console.dir(peerA.lookup(), { depth: 5 })
          console.groupEnd()
          console.group('remoteExports')
          console.dir(peerA.remoteExports.lookup(), { depth: 5 })
          console.groupEnd()
          console.groupEnd()
          console.group('peerB')
          console.group('sourceExports')
          console.dir(peerB.lookup(), { depth: 5 })
          console.groupEnd()
          console.group('remoteExports')
          console.dir(peerB.remoteExports.lookup(), { depth: 5 })
          console.groupEnd()
          console.groupEnd()
        })
      }
      if (assertWants) {
        assert.equal(wants, assertWants, message)
      }
    }
    whatsUp('should all be empty', { asw: [], arw: [], bsw: [], brw: [] }, false)

    console.log('\n\nrunIndex:', globalRunner.runIndex)
    const hashwordA = await hashNameAndPassword('userA', `password${Date.now()}.${globalRunner.runIndex}`, 10)
    const committerA = new Committer('a', hashwordA, recallerA)

    getPointerByPublicKey(committerA.compactPublicKey, recallerA, committerA)
    peerA.addSourceObject(committerA.compactPublicKey, 'peerA.addSourceObject')

    whatsUp('A (local) should have an empty sourceObject', { asw: [0], arw: [], bsw: [], brw: [] })
    handleNextTick()
    whatsUp('A (both) should have an empty sourceObject', { asw: [0], arw: [0], bsw: [0], brw: [0] })

    const firstCommit = committerA.commit('first commit', { a: 1 })
    whatsUp('A (both) should STILL have an empty sourceObject', { asw: [0], arw: [0], bsw: [0], brw: [0] })
    await firstCommit
    handleNextTick()
    whatsUp('A (both) should have a sourceObject at 1', { asw: [1], arw: [1], bsw: [1], brw: [1] })
    const secondCommit = committerA.commit('second commit', { a: 1, b: 1 })
    whatsUp('A (both) should STILL have a sourceObject at 1', { asw: [1], arw: [1], bsw: [1], brw: [1] })
    await secondCommit
    handleNextTick()
    whatsUp('A (both) should have a sourceObject at 2', { asw: [2], arw: [2], bsw: [2], brw: [2] })

    const uia8LPB = new Uint8ArrayLayerPointer(undefined, recallerB)
    getPointerByPublicKey(committerA.compactPublicKey, recallerB, uia8LPB)
    peerB.addSourceObject(committerA.compactPublicKey, 'peerB.addSourceObject')
    whatsUp('B (local) should have an empty sourceObject', { asw: [2], arw: [2], bsw: [2], brw: [2] })
  })
})
