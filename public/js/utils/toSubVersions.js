/**
 * @param {number} combinedVersion
 * @param {Array.<number>} versionArrayCounts
 * @return {Array.<number}
 */
export const toSubVersions = (combinedVersion, versionArrayCounts) => {
  const versionArrays = new Array(versionArrayCounts.length)
  for (let i = versionArrays.length - 1; i >= 0; --i) {
    const versionArrayCount = versionArrayCounts[i]
    versionArrays[i] = combinedVersion % versionArrayCount
    combinedVersion = Math.floor(combinedVersion / versionArrayCount)
  }
  return versionArrays
}
