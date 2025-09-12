/**
 * @param {Array.<number>} versionArrayCounts
 * @return number
 */
export const toVersionCount = versionArrayCounts => versionArrayCounts.reduce((acc, value) => acc * value, 1)
