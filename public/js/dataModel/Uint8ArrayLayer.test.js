import { Uint8ArrayLayer } from './Uint8ArrayLayer.js'

const { default: chai } = await import('../utils/chaiPromise.test.js')

describe('Uint8ArrayLayer', function () {
  it('does basic indexing through multiple layers', function () {
    let ui8Layer = new Uint8ArrayLayer(new Uint8Array(100))
    for (let i = 1; i < 0b100000; ++i) {
      ui8Layer = new Uint8ArrayLayer(new Uint8Array([i, i, i]), ui8Layer)
    }
    for (let i = 0; i < 0b100000; ++i) {
      chai.assert.equal(ui8Layer.getLayerAtIndex(i).layerIndex, i)
    }
    chai.assert.equal(ui8Layer.getByte(0), 0)
    chai.assert.equal(ui8Layer.getByte(100), 1)
    chai.assert.equal(ui8Layer.getByte(ui8Layer.length - 6), 0b11110)
    chai.assert.equal(ui8Layer.getByte(ui8Layer.length - 1), 0b11111)
    chai.assert.equal(ui8Layer.getByte(ui8Layer.length), undefined)
  })
  it('collapses layers correctly', function () {
    let ui8Layer = new Uint8ArrayLayer(new Uint8Array(100))
    for (let i = 1; i < 0b100000; ++i) {
      ui8Layer = new Uint8ArrayLayer(new Uint8Array([i, i, i]), ui8Layer)
    }
    ui8Layer = ui8Layer.collapseTo(1)
    chai.assert.equal(ui8Layer.getByte(0), 0)
    chai.assert.equal(ui8Layer.getByte(100), 1)
    chai.assert.equal(ui8Layer.getByte(ui8Layer.length - 6), 0b11110)
    chai.assert.equal(ui8Layer.getByte(ui8Layer.length - 1), 0b11111)
    chai.assert.equal(ui8Layer.getByte(ui8Layer.length), undefined)
    ui8Layer = ui8Layer.collapseTo()
    chai.assert.equal(ui8Layer.uint8Array[0], 0)
    chai.assert.equal(ui8Layer.uint8Array[100], 1)
    chai.assert.equal(ui8Layer.uint8Array[ui8Layer.length - 6], 0b11110)
    chai.assert.equal(ui8Layer.uint8Array[ui8Layer.length - 1], 0b11111)
    chai.assert.equal(ui8Layer.uint8Array[ui8Layer.length], undefined)
    chai.assert.equal(ui8Layer.length, ui8Layer.uint8Array.length)
  })
})
