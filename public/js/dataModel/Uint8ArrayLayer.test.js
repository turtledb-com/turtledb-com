import { globalRunner, urlToName } from '../../test/Runner.js'
import { hashNameAndPassword } from '../utils/crypto.js'
import { Committer } from './Committer.js'
import { Uint8ArrayLayer } from './Uint8ArrayLayer.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('does basic indexing through multiple layers', ({ assert }) => {
    let ui8Layer = new Uint8ArrayLayer(new Uint8Array(100))
    for (let i = 1; i < 0b100000; ++i) {
      ui8Layer = new Uint8ArrayLayer(new Uint8Array([i, i, i]), ui8Layer)
    }
    for (let i = 0; i < 0b100000; ++i) {
      assert.equal(ui8Layer.getLayerAtIndex(i).layerIndex, i)
    }
    assert.equal(ui8Layer.getByte(0), 0)
    assert.equal(ui8Layer.getByte(100), 1)
    assert.equal(ui8Layer.getByte(ui8Layer.length - 6), 0b11110)
    assert.equal(ui8Layer.getByte(ui8Layer.length - 1), 0b11111)
    assert.equal(ui8Layer.getByte(ui8Layer.length), undefined)
  })
  suite.it('collapses layers correctly', ({ assert }) => {
    let ui8Layer = new Uint8ArrayLayer(new Uint8Array(100))
    for (let i = 1; i < 0b100000; ++i) {
      ui8Layer = new Uint8ArrayLayer(new Uint8Array([i, i, i]), ui8Layer)
    }
    ui8Layer = ui8Layer.collapseTo(1)
    assert.equal(ui8Layer.getByte(0), 0)
    assert.equal(ui8Layer.getByte(100), 1)
    assert.equal(ui8Layer.getByte(ui8Layer.length - 6), 0b11110)
    assert.equal(ui8Layer.getByte(ui8Layer.length - 1), 0b11111)
    assert.equal(ui8Layer.getByte(ui8Layer.length), undefined)
    ui8Layer = ui8Layer.collapseTo()
    assert.equal(ui8Layer.uint8Array[0], 0)
    assert.equal(ui8Layer.uint8Array[100], 1)
    assert.equal(ui8Layer.uint8Array[ui8Layer.length - 6], 0b11110)
    assert.equal(ui8Layer.uint8Array[ui8Layer.length - 1], 0b11111)
    assert.equal(ui8Layer.uint8Array[ui8Layer.length], undefined)
    assert.equal(ui8Layer.length, ui8Layer.uint8Array.length)
  })
  suite.it('handles getting commit values', async () => {
    const hashword = await hashNameAndPassword('test-user', 'password')
    const committer = new Committer('test', hashword)
    await committer.commit('test commit', {
      a: ['one', 'two'],
      b: {
        x: {
          n: true
        },
        y: null,
        z: undefined
      },
      c: new Map([
        ['p', 'pea'],
        ['q', 'queue']
      ])
    })
    console.log(committer.getAddress())
    console.log(committer.getValue('value', 'b', 'x', 'n'))
    console.log(committer.getRefs('value', 'c'))
  })
})
