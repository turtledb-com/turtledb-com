import { Recaller } from '../utils/Recaller.js'
import { ALL_CODECS, Codec, KIND, getCodecs } from './CODECS.js'
import { Uint8ArrayLayer, collapseUint8Arrays } from './Uint8ArrayLayer.js'
import { Uint8ArrayLayerPointer } from './Uint8ArrayLayerPointer.js'

export const FRESH_ADDRESS_GETTER = Symbol('update if stale and return fresh address')
export const PROXIED_UPSERTER = Symbol('proxied upserter')

export const ADD_STALE_WATCHER = Symbol('add stale watcher')
export const DELETE_STALE_WATCHER = Symbol('delete stale watcher')

export class Upserter extends Uint8ArrayLayerPointer {
  #codeDictionary = {}

  /**
   * @param {Uint8ArrayLayer} [uint8ArrayLayer=new Uint8ArrayLayer()]
   */
  constructor (name = 'Upserter', recaller = new Recaller(name), uint8ArrayLayer) {
    super(uint8ArrayLayer, recaller, name)
    if (this.length === undefined) return
    const end = uint8ArrayLayer.length - 1
    this.lexicograph(0, end)
  }

  /** @param {Uint8Array} uint8Array */
  append (uint8Array) {
    const start = (this.uint8ArrayLayer?.length ?? 0) - 1
    super.append(uint8Array)
    const end = this.uint8ArrayLayer.length - 1
    this.lexicograph(start, end)
  }

  lexicograph (start, end) {
    let uint8ArrayLayer = this.uint8ArrayLayer
    while (end > start) {
      uint8ArrayLayer = uint8ArrayLayer.getLayerContainingAddress(end)
      const footer = uint8ArrayLayer.getByte(end)
      const codec = Codec.calculateCodec(footer, ALL_CODECS)
      const isOpaque = codec.kinds.includes(KIND.OPAQUE)
      const { blocks, nextAddress } = codec.decodeBlocksAndNextAddress(uint8ArrayLayer, end, footer)
      const code = collapseUint8Arrays(...blocks, footer)
      if (!isOpaque) this.#setAddressForCode(code, end)
      end = nextAddress
      if (end < start - 1) {
        console.error({ start, end, blocks, nextAddress, code })
        throw new Error('block miscalculation')
      }
    }
  }

  /**
   * @param {any} value
   * @param {Codec} codec [codec=getCodecs()]
   * @returns {number}
   */
  upsert (value, codec = getCodecs()) {
    if (value && value[FRESH_ADDRESS_GETTER]) {
      const address = value[FRESH_ADDRESS_GETTER]()
      if (value[PROXIED_UPSERTER] === this) return address
      else value = value[PROXIED_UPSERTER].getValue(address)
    }
    if (Array.isArray(codec)) codec = (codec.length === 1) ? codec[0] : codec.find(codec => codec.test(value))
    if (!codec) throw new Error(`no matching codec for ${value}`)
    const code = codec.encode(this, value)
    const isOpaque = codec.kinds.includes(KIND.OPAQUE)
    return this.#findOrCreateAddressForCode(code, isOpaque)
  }

  upserterProxy (address) {
    if (!this.uint8ArrayLayer) return
    const uint8ArrayLayer = this.uint8ArrayLayer
    if (address === undefined) {
      const signedCommitWrapper = uint8ArrayLayer.lookup(undefined, getCodecs(KIND.REFS_TOP))
      const commit = uint8ArrayLayer.lookup(signedCommitWrapper.commit, getCodecs(KIND.REFS_TOP))
      address = commit.value
    }
    const target = uint8ArrayLayer.lookup(address, getCodecs(KIND.REFS_TOP))
    if (typeof target !== 'object') return uint8ArrayLayer.lookup(target)
    const staleWatchers = new Set()
    let isStale = false
    let staleKeys = new Set()
    const cached = {}
    const refreshedCache = propertyKey => {
      if (!Object.hasOwn(cached, propertyKey)) cached[propertyKey] = this.upserterProxy(target[propertyKey])
      cached[propertyKey]?.[ADD_STALE_WATCHER]?.(makeStaleKeySetter(propertyKey))
      return cached[propertyKey]
    }
    const makeStale = propertyKey => {
      if (propertyKey) staleKeys.add(propertyKey)
      if (!cached[propertyKey]?.[ADD_STALE_WATCHER]) delete cached[propertyKey]
      if (isStale) return
      isStale = true
      staleWatchers.forEach(watcher => watcher())
    }
    const staleKeySetters = {}
    const makeStaleKeySetter = propertyKey => {
      if (!staleKeySetters[propertyKey]) staleKeySetters[propertyKey] = () => makeStale(propertyKey)
      return staleKeySetters[propertyKey]
    }
    const addStaleWatcher = watcher => staleWatchers.add(watcher)
    const deleteStaleWatcher = watcher => staleWatchers.delete(watcher)
    const updatedAddress = () => {
      if (isStale) {
        staleKeys.forEach(propertyKey => { target[propertyKey] = this.upsert(refreshedCache(propertyKey)) })
        address = this.upsert(target, getCodecs(KIND.REFS_TOP))
        isStale = false
        staleKeys = new Set()
      }
      return address
    }
    return new Proxy(target, {
      get: (target, propertyKey) => {
        if (propertyKey === PROXIED_UPSERTER) return this
        if (propertyKey === FRESH_ADDRESS_GETTER) return updatedAddress
        if (propertyKey === 'length' && Array.isArray(target)) return target.length
        if (propertyKey === ADD_STALE_WATCHER) return addStaleWatcher
        if (propertyKey === DELETE_STALE_WATCHER) return deleteStaleWatcher
        if (!Object.hasOwn(target, propertyKey) && !Object.hasOwn(cached, propertyKey)) return
        return refreshedCache(propertyKey)
      },
      set: (_target, propertyKey, newValue) => {
        makeStale(propertyKey)
        cached[propertyKey] = newValue
        cached[propertyKey]?.[ADD_STALE_WATCHER]?.(makeStaleKeySetter(propertyKey))
        return true
      },
      deleteProperty: (target, propertyKey) => {
        makeStale()
        staleKeys.delete(propertyKey)
        cached?.[propertyKey]?.[DELETE_STALE_WATCHER]?.(makeStaleKeySetter(propertyKey))
        delete cached[propertyKey]
        delete staleKeySetters[propertyKey]
        return Reflect.deleteProperty(target, propertyKey)
      }
    })
  }

  #findExistingCode (code) {
    if (code[FRESH_ADDRESS_GETTER] !== undefined) return code[FRESH_ADDRESS_GETTER]()
    let branch = this.#codeDictionary
    for (const byte of code) {
      branch = branch[byte]
      if (!branch) return undefined
    }
    return branch.address
  }

  #setAddressForCode (code, address) {
    if (typeof address !== 'number') throw new Error('address must be number')
    let branch = this.#codeDictionary
    for (const byte of code) {
      branch[byte] ??= {}
      branch = branch[byte]
    }
    branch.address = address
  }

  #findOrCreateAddressForCode (code, isOpaque) {
    const existingAddress = this.#findExistingCode(code)
    if (existingAddress !== undefined) return existingAddress
    this.uint8ArrayLayer = new Uint8ArrayLayer(code, this.uint8ArrayLayer)
    const newAddress = this.uint8ArrayLayer.length - 1
    if (!isOpaque) this.#setAddressForCode(code, newAddress)
    return newAddress
  }

  cleanup () {
    this.#codeDictionary = null
  }
}
