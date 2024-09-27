import { Recaller } from '../utils/Recaller.js'
import { handleNextTick } from '../utils/nextTick.js'
import { ADDRESS, Uint8ArrayLayerPointer } from './Uint8ArrayLayerPointer.js'
import { Upserter } from './Upserter.js'

const { default: chai } = await import('../utils/chaiPromise.test.js')

describe('Uint8ArrayLayerPointer', function () {
  it('triggers appropriate updates when changes occur', function () {
    const recaller = new Recaller('TRIGGERS-APPROPRIATELY')
    // recaller.debug = true
    const upserter = new Upserter(undefined, recaller)
    const uint8ArrayLayerPointer = new Uint8ArrayLayerPointer(upserter.uint8ArrayLayer, recaller, 'TRIGGERS-APPROPRIATELY')
    chai.assert.isUndefined(uint8ArrayLayerPointer.presenterProxy())
    upserter.upsert({ a: 1, b: 2 })
    uint8ArrayLayerPointer.uint8ArrayLayer = upserter.uint8ArrayLayer
    const presenterProxy = uint8ArrayLayerPointer.presenterProxy()
    recaller.watch('upserter-changes-copier', () => {
      uint8ArrayLayerPointer.uint8ArrayLayer = upserter.uint8ArrayLayer
      presenterProxy[ADDRESS] = upserter.uint8ArrayLayer.length - 1
    })
    const changes = []
    recaller.watch('a changed', () => {
      changes.push(`a:${presenterProxy.a}`)
    })
    recaller.watch('b changed', () => {
      changes.push(`b:${presenterProxy.b}`)
    })
    handleNextTick()
    chai.assert.deepEqual(changes, ['a:1', 'b:2'])
    upserter.upsert({ a: 1, b: 3 })
    handleNextTick()
    chai.assert.deepEqual(changes, ['a:1', 'b:2', 'b:3'])
  })
  it('proxies arrays too', function () {
    const upserter = new Upserter()
    upserter.upsert(['abc', 'xyz'])
    chai.assert.deepEqual(upserter.presenterProxy(), ['abc', 'xyz'])
    upserter.upsert({ a: 123, x: 456 })
    upserter.upsert({ a: 321, x: 456 })
    upserter.upsert(['abcd', 'wxyz'])
    chai.assert.deepEqual(upserter.presenterProxy(), ['abcd', 'wxyz'])
    chai.assert.deepEqual([...upserter.presenterProxy()], ['abcd', 'wxyz'])
  })
})
