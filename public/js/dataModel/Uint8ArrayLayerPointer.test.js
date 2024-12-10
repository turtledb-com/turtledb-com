import { globalRunner, urlToName } from '../../test/Runner.js'
import { Recaller } from '../utils/Recaller.js'
import { handleNextTick } from '../utils/nextTick.js'
import { ADDRESS, Uint8ArrayLayerPointer } from './Uint8ArrayLayerPointer.js'
import { Upserter } from './Upserter.js'

globalRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('triggers appropriate updates when changes occur', ({ assert }) => {
    const recaller = new Recaller('TRIGGERS-APPROPRIATELY')
    // recaller.debug = true
    const upserter = new Upserter(undefined, recaller)
    const uint8ArrayLayerPointer = new Uint8ArrayLayerPointer(upserter.uint8ArrayLayer, recaller, 'TRIGGERS-APPROPRIATELY')
    assert.equal(undefined, uint8ArrayLayerPointer.presenterProxy())
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
    assert.equal(changes, ['a:1', 'b:2'])
    upserter.upsert({ a: 1, b: 3 })
    handleNextTick()
    assert.equal(changes, ['a:1', 'b:2', 'b:3'])
  })
  suite.it('proxies arrays too', ({ assert }) => {
    const upserter = new Upserter()
    upserter.upsert(['abc', 'xyz'])
    assert.equal(upserter.presenterProxy(), ['abc', 'xyz'])
    upserter.upsert({ a: 123, x: 456 })
    upserter.upsert({ a: 321, x: 456 })
    upserter.upsert(['abcd', 'wxyz'])
    assert.equal(upserter.presenterProxy(), ['abcd', 'wxyz'])
    assert.equal([...upserter.presenterProxy()], ['abcd', 'wxyz'])
  })
})
