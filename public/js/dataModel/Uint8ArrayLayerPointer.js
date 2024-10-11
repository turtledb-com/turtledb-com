import { Recaller } from '../utils/Recaller.js'
import { CODECS, Codec, KIND, getCodecs } from './CODECS.js'
import { Uint8ArrayLayer } from './Uint8ArrayLayer.js'

export const UINT8ARRAYLAYER = Symbol('uint8ArrayLayer update')
export const ADDRESS = Symbol('address')
export const OWN_KEYS = Symbol('ownKeys')

export class Uint8ArrayLayerPointer {
  /** @property {Uint8ArrayLayer} */
  #uint8ArrayLayer

  /**
   * @param {(Uint8ArrayLayer|undefined)} uint8ArrayLayer
   * @param {Recaller} [recaller=new Recaller('Uint8ArrayLayerPointer')]
   * @param {string} [name='Uint8ArrayLayerPointer']
   */
  constructor (uint8ArrayLayer, recaller = new Recaller('Uint8ArrayLayerPointer'), name = 'Uint8ArrayLayerPointer') {
    this.recaller = recaller
    this.name = name
    this.uint8ArrayLayer = uint8ArrayLayer
  }

  /** @type {Uint8ArrayLayer} */
  get uint8ArrayLayer () {
    this.recaller.reportKeyAccess(this, UINT8ARRAYLAYER, 'get', this.name)
    return this.#uint8ArrayLayer
  }

  set uint8ArrayLayer (uint8ArrayLayer) {
    if (uint8ArrayLayer && !(uint8ArrayLayer instanceof Uint8ArrayLayer)) {
      console.error(uint8ArrayLayer)
      throw new Error('must be actual Uint8ArrayLayer')
    }
    this.#uint8ArrayLayer = uint8ArrayLayer
    this.recaller.reportKeyMutation(this, UINT8ARRAYLAYER, 'set', this.name)
  }

  get length () { return this.uint8ArrayLayer?.length ?? -1 }

  get layerIndex () { return this.uint8ArrayLayer?.layerIndex ?? -1 }

  lookup (address, codecs) { return this.uint8ArrayLayer?.lookup?.(address, codecs) }

  getLayerAtIndex (layerIndex) { return this.uint8ArrayLayer?.getLayerAtIndex?.(layerIndex) }

  getLayerContainingAddress (address) { return this.uint8ArrayLayer?.getLayerContainingAddress?.(address) }

  getByte (address) { return this.uint8ArrayLayer?.getByte?.(address) }

  collapseTo (layerIndex) { this.uint8ArrayLayer = this.uint8ArrayLayer?.collapseTo?.(layerIndex) }

  slice (start, end) { return this.uint8ArrayLayer?.slice?.(start, end) }

  /**
   * @param {Uint8Array} uint8Array
   */
  append (uint8Array) {
    if (!this.uint8ArrayLayer) this.uint8ArrayLayer = new Uint8ArrayLayer(uint8Array)
    else this.uint8ArrayLayer = new Uint8ArrayLayer(uint8Array, this.uint8ArrayLayer)
    return this.uint8ArrayLayer.length
  }

  lookupRefs (address, ...path) {
    let value = this.lookup(address, getCodecs(KIND.REFS_TOP))
    while (value && path.length) {
      const address = value[path.shift()]
      if (!address) return undefined
      value = this.lookup(address, getCodecs(KIND.REFS_TOP))
    }
    return value
  }

  getCommitAddress (address = this.length - 1) {
    return getCommitAddress(this, address)
  }

  getCommit (address, codecs) {
    return this.lookup(this.getCommitAddress(address), codecs)
  }

  getCommitValue (...path) {
    let valueName = 'value'
    if (path.length && typeof path[path.length - 1] === 'string') {
      valueName = path.pop()
    }
    let codecs
    if (path.length && Array.isArray(path[0])) {
      codecs = path.shift()
    }
    const refs = this.lookupRefs(this.getCommitAddress(), ...path)
    const valueAddress = refs?.[valueName]
    if (typeof valueAddress !== 'number') return
    console.log({ path, valueName, valueAddress, codecs })
    return this.lookup(refs[valueName], codecs)
  }

  presenterProxy (address, name = `${this.name}.proxy`) {
    if (!this.#uint8ArrayLayer) return this.uint8ArrayLayer // trigger reportKeyAccess
    const cached = {}

    const setAddress = newAddress => {
      if (newAddress === -1) throw new Error('Uint8ArrayLayerPresenter cannot proxy empty Uint8ArrayLayer')
      if (target && newAddress === address) return
      this.recaller.reportKeyMutation(target, ADDRESS, 'set', name)
      address = newAddress
      const newTarget = this.#uint8ArrayLayer.lookup(address, getCodecs(KIND.REFS_TOP))

      if (!target) {
        target = newTarget
        return
      }
      for (const key in newTarget) {
        if (newTarget[key] !== target[key]) {
          this.recaller.reportKeyMutation(target, key, 'address', name)
          delete cached[key]
          target[key] = newTarget[key]
        }
      }
      for (const key in target) {
        if (!Object.hasOwn(newTarget, key)) {
          this.recaller.reportKeyMutation(target, key, 'address', name)
          delete cached[key]
          delete target[key]
        }
      }
    }

    let target
    if (address == null) {
      this.recaller.watch(name, () => {
        setAddress(this.uint8ArrayLayer.length - 1)
      })
    } else {
      setAddress(address)
    }

    if (typeof target !== 'object') return this.#uint8ArrayLayer.lookup(target)
    return new Proxy(target, {
      has: (target, propertyKey) => {
        this.recaller.reportKeyAccess(target, propertyKey, 'get', name)
        return Reflect.has(target, propertyKey) || propertyKey === ADDRESS
      },
      get: (target, propertyKey) => {
        this.recaller.reportKeyAccess(target, propertyKey, 'get', name)
        if (propertyKey === ADDRESS) return address
        if (propertyKey === 'length' && Array.isArray(target)) return target.length
        if (!Object.hasOwn(target, propertyKey)) return Reflect.get(target, propertyKey)
        if (!Object.hasOwn(cached, propertyKey)) cached[propertyKey] = this.presenterProxy(target[propertyKey], `${name}.${propertyKey}`)
        return cached[propertyKey]
      },
      set: (_target, propertyKey, value) => {
        if (propertyKey !== ADDRESS) throw new Error('Uint8ArrayLayerPresenter expose data at an address, only set address allowed')
        setAddress(value)
        return true
      },
      deleteProperty: () => {
        throw new Error('Uint8ArrayLayerPresenter expose data at an address, delete not allowed')
      },
      ownKeys: target => {
        this.recaller.reportKeyAccess(target, OWN_KEYS, 'ownKeys', name)
        return Reflect.ownKeys(target)
      }
    })
  }
}

/** @param {Uint8ArrayLayerPointer} uint8ArrayLayerPointer  */
export function getCommitAddress (uint8ArrayLayerPointer, signatureAddress = uint8ArrayLayerPointer.length - 1) {
  if (signatureAddress < 0) return undefined
  const uint8ArrayLayer = uint8ArrayLayerPointer.getLayerContainingAddress(signatureAddress)
  const footer = uint8ArrayLayerPointer.getByte(signatureAddress)
  const codec = Codec.calculateCodec(footer, CODECS)
  const { blocks } = codec.decodeBlocksAndNextAddress(uint8ArrayLayer, signatureAddress, footer)
  return signatureAddress - 1 - blocks.length - 64
}
