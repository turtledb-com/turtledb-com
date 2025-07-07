import { handleNextTick } from '../utils/nextTick.js'
import { proxyWithRecaller } from '../utils/proxyWithRecaller.js'
import { Recaller } from '../utils/Recaller.js'
import { b36ToBigInt, b36ToUint8Array, bigIntToUint8Array, cpkBaleHostToPath, decodeNumberFromU8a, encodeNumberToU8a, pathToCpkBaleHost, softAssign, uint8ArrayToB36, uint8ArrayToBigInt, ValueByUint8Array } from './utils.js'
import { combineUint8Arrays } from '../utils/combineUint8Arrays.js'
import { combineUint8ArrayLikes } from '../utils/combineUint8ArrayLikes.js'
import { toCombinedVersion } from '../utils/toCombinedVersion.js'
import { toSubVersions } from '../utils/toSubVersions.js'
import { toVersionCount } from '../utils/toVersionCount.js'
import { zabacaba } from '../utils/zabacaba.js'
import { globalTestRunner, urlToName } from '../utils/TestRunner.js'

globalTestRunner.describe(urlToName(import.meta.url), suite => {
  suite.it('goes from path to host/bale/cpk and back', ({ assert }) => {
    ; [
      ['turtledb.com/a/a', ['a', 'a', 'turtledb.com'], 'a'],
      ['b.com/a/a', ['a', 'a', 'b.com'], 'b.com/a/a'],
      ['a/a', ['a', 'a', 'turtledb.com'], 'a'],
      ['b/a', ['a', 'b', 'turtledb.com'], 'b/a'],
      ['a', ['a', 'a', 'turtledb.com'], 'a']
    ].forEach(vector => {
      const [path, cpkBaleHost, repath] = vector
      assert.equal(pathToCpkBaleHost(path), cpkBaleHost)
      assert.equal(cpkBaleHostToPath(...cpkBaleHost), repath)
    })
  })
  suite.it('softAssigns completely', ({ assert }) => {
    const obj = { a: 1, b: 2 }
    ;[
      { b: 3, c: [1, 2, 3] },
      { c: [1, 2, 3,,,] }, // eslint-disable-line no-sparse-arrays
      { c: [, 2] } // eslint-disable-line no-sparse-arrays
    ].forEach(vector => {
      softAssign(obj, vector)
      assert.equal(obj, vector)
    })
  })
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
      const versionArrays = toSubVersions(combinedVersion, versionParts)
      const _combinedVersion = toCombinedVersion(versionArrays, versionParts)
      // console.log(versionArrays, combinedVersion)
      assert.equal(combinedVersion, _combinedVersion, `combinedVersion: ${combinedVersion} to versionArrays${versionArrays} and back ${_combinedVersion}`)
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
    assert.equal(u8aFFFFFF.length, 3)
    assert.equal(decodeNumberFromU8a(u8aFFFFFF), 0xFFFFFF)
  })
  suite.it('translates big ints', ({ assert }) => {
    const bigInt = 1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890n
    const b36BigInt = bigInt.toString(36)
    const recoveredBigInt = b36ToBigInt(b36BigInt)
    assert.equal(bigInt, recoveredBigInt)
    const uint8Array = bigIntToUint8Array(bigInt)
    const recoveredFromUint8Array = uint8ArrayToBigInt(uint8Array)
    assert.equal(bigInt, recoveredFromUint8Array)
    const uint8Array2 = b36ToUint8Array(b36BigInt)
    assert.equal(uint8Array, uint8Array2)
    const b36 = uint8ArrayToB36(uint8Array2)
    assert.equal(b36, b36BigInt)
  })
  suite.it('proxyWithRecaller', ({ assert }) => {
    const recaller = new Recaller('proxyWithRecaller')
    const proxiedArray = proxyWithRecaller([1, 2, 3], recaller)
    const arrayIndex1Updates = []
    const arrayLengthUpdates = []
    recaller.watch('proxiedArray index 1', () => {
      arrayIndex1Updates.push(proxiedArray[1])
    })
    recaller.watch('proxiedArray length', () => {
      arrayLengthUpdates.push(proxiedArray.length)
    })
    assert.equal(arrayIndex1Updates, [2])
    assert.equal(arrayLengthUpdates, [3])
    handleNextTick()
    assert.equal(arrayIndex1Updates, [2])
    assert.equal(arrayLengthUpdates, [3])
    proxiedArray[1] = 4
    handleNextTick()
    assert.equal(arrayIndex1Updates, [2, 4])
    assert.equal(arrayLengthUpdates, [3])
    proxiedArray[2] = 4
    handleNextTick()
    assert.equal(arrayIndex1Updates, [2, 4])
    assert.equal(arrayLengthUpdates, [3])
    proxiedArray[5] = 4
    handleNextTick()
    assert.equal(arrayIndex1Updates, [2, 4])
    assert.equal(arrayLengthUpdates, [3, 6])
    proxiedArray.pop()
    handleNextTick()
    assert.equal(arrayIndex1Updates, [2, 4])
    assert.equal(arrayLengthUpdates, [3, 6, 5])
  })
})
