import { OWN_KEYS } from './OWN_KEYS.js'
import { Recaller } from './Recaller.js'

/**
 * @param {Object} target
 * @param {Recaller} [recaller=new Recaller('<unnamed proxyWithRecaller>')]
 * @param {string} [name=recaller.name]
 */
export function proxyWithRecaller (
  target,
  recaller = new Recaller('<unnamed proxyWithRecaller>'),
  name = recaller.name
) {
  if (!name && recaller) name = recaller.name
  if (!target || typeof target !== 'object') throw new Error('proxyWithRecaller can only proxy objects')
  return new Proxy(target, {
    has: (target, propertyKey) => {
      recaller.reportKeyAccess(target, propertyKey, 'get', name)
      return Reflect.has(target, propertyKey)
    },
    get: (target, propertyKey) => {
      recaller.reportKeyAccess(target, propertyKey, 'get', name)
      if (propertyKey === 'length' && Array.isArray(target)) return target.length
      return Reflect.get(target, propertyKey)
    },
    set: (target, propertyKey, value) => {
      const length = target.length
      if (value !== target[propertyKey]) {
        recaller.reportKeyMutation(target, propertyKey, 'set', name)
      }
      if (!(propertyKey in target)) {
        recaller.reportKeyMutation(target, OWN_KEYS, 'set', name)
      }
      const result = Reflect.set(target, propertyKey, value)
      if (Array.isArray(target) && length !== target.length) {
        recaller.reportKeyMutation(target, 'length', 'set', name)
      }
      return result
    },
    deleteProperty: (target, propertyKey) => {
      if (propertyKey in target) {
        recaller.reportKeyMutation(target, OWN_KEYS, 'delete', name)
      }
      return Reflect.deleteProperty(target, propertyKey)
    },
    ownKeys: target => {
      recaller.reportKeyAccess(target, OWN_KEYS, 'ownKeys', name)
      return Reflect.ownKeys(target)
    }
  })
}
