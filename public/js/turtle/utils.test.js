import { globalRunner, urlToName } from '../../test/Runner.js'
import { combineUint8ArrayLikes, combineUint8Arrays, decodeNumberFromU8a, encodeNumberToU8a, toCombinedVersion, toSubVersions, toVersionCount, ValueByUint8Array, zabacaba } from './utils.js'

globalRunner.only.describe(urlToName(import.meta.url), suite => {
  suite.it('returns expected values for a zabacaba function', ({ assert }) => {
    const expectedResults = [
      0,
      1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 5,
      1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 6,
      1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 5,
      1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 7,
      1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 5
    ]
    for (let i = 0; i < expectedResults.length; ++i) {
      const expected = expectedResults[i]
      const actual = zabacaba(i)
      assert.equal(actual, expected, `zabacaba(${i}) expected: ${expected}, actual: ${actual}`)
    }
  })
  suite.it('combines uint8Arrays', ({ assert }) => {
    assert.equal(new Uint8Array([1, 2, 3, 4, 5, 6]), combineUint8Arrays([
      new Uint8Array([1]),
      new Uint8Array([2, 3]),
      new Uint8Array([]),
      new Uint8Array([4, 5, 6])
    ]))
  })
  suite.it('combines uint8ArrayLikes', ({ assert }) => {
    assert.equal(new Uint8Array([1, 2, 3, 4, 5, 6]), combineUint8ArrayLikes([
      1,
      new Uint16Array((new Uint8Array([2, 3])).buffer),
      new Uint8Array([]),
      new Uint8Array([4, 5, 6])
    ]))
  })
  suite.it('turns versions to subversion-arrays and back', ({ assert }) => {
    const versionParts = [2, 3, 4]
    const versionCount = toVersionCount(versionParts)
    for (let combinedVersion = 0; combinedVersion < versionCount; ++combinedVersion) {
      const subVersions = toSubVersions(combinedVersion, versionParts)
      const _combinedVersion = toCombinedVersion(subVersions, versionParts)
      // console.log(subVersions, combinedVersion)
      assert.equal(combinedVersion, _combinedVersion, `combinedVersion: ${combinedVersion} to subVersions${subVersions} and back ${_combinedVersion}`)
    }
  })
  suite.it('stores and retrieves values by Uint8Array', ({ assert }) => {
    const valueByUint8Array = new ValueByUint8Array()
    const uint8Arrays = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([1, 2]),
      new Uint8Array([1, 2, 3, 4]),
      new Uint8Array([]),
      new Uint8Array([3]),
      new Uint8Array([3, 2]),
      new Uint8Array([3, 1])
    ]
    for (let i = 0; i < uint8Arrays.length; ++i) {
      const uint8Array = uint8Arrays[i]
      const unsetValue = valueByUint8Array.get(uint8Array)
      assert.equal(unsetValue, undefined, `unset value for ${uint8Array} should be undefined`)
      valueByUint8Array.set(uint8Array, i)
      const setValue = valueByUint8Array.get(uint8Array)
      assert.equal(setValue, i, `set value for ${uint8Array} should be ${i}`)
    }
    for (let i = 0; i < uint8Arrays.length; ++i) {
      const uint8Array = uint8Arrays[i]
      const setValue = valueByUint8Array.get(uint8Array)
      assert.equal(setValue, i, `set value for ${uint8Array} should be ${i}`)
    }
  })
  suite.it('encodes and decodes numbers to and from Uint8Arrays', ({ assert }) => {
    const u8aZero = encodeNumberToU8a(0, 2)
    assert.equal(u8aZero.length, 2, 'zero should have minimum length')
    assert.equal(decodeNumberFromU8a(u8aZero), 0)
    const u8aFFFFFF = encodeNumberToU8a(0xFFFFFF, 2)
    console.log(u8aFFFFFF)
    assert.equal(u8aFFFFFF.length, 3)
    assert.equal(decodeNumberFromU8a(u8aFFFFFF), 0xFFFFFF)
  })
})
