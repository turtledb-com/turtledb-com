export function deepEqual (a, b) {
  if (!a !== !b) return false
  if (!a && !b && a === b) return true
  const aType = typeof a
  const bType = typeof b
  if (aType !== bType) return false
  if (aType !== 'object') return a === b
  if (
    !(a.constructor.name === 'Object' && b.constructor.name === 'Object') &&
    (a.constructor !== b.constructor)
  ) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(key => deepEqual(a[key], b[key]))
}
