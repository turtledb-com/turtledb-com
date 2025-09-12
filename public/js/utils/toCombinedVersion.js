/**
 * @param {Array.<number>} versionArrays
 * @param {Array.<number>} versionArrayCounts
 * @return number
 */
export const toCombinedVersion = (versionArrays, versionArrayCounts) => {
  if (versionArrays.length !== versionArrayCounts.length) throw new Error('versionArrays/versionArrayCounts mismatch')
  let combinedVersion = 0
  for (let i = 0; i < versionArrays.length; ++i) {
    combinedVersion *= versionArrayCounts[i]
    combinedVersion += versionArrays[i]
  }
  return combinedVersion
}
