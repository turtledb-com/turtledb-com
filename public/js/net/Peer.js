import { KIND, getCodecs } from '../dataModel/CODECS.js'
import { Uint8ArrayLayerPointer } from '../dataModel/Uint8ArrayLayerPointer.js'
import { Upserter } from '../dataModel/Upserter.js'
import { Recaller } from '../utils/Recaller.js'

/** @typedef {{sent: Array.<number>, want: Array.<[number, number]>}} SourceObject */

export const peerRecaller = new Recaller('Peer.js')

/** @type {Object.<string, Uint8ArrayLayerPointer>} */
const pointersByPublicKey = {}
export const setPointerByPublicKey = (
  compactPublicKey,
  recaller = peerRecaller,
  uint8ArrayLayerPointer = new Uint8ArrayLayerPointer(undefined, recaller, compactPublicKey)
) => {
  if (!pointersByPublicKey[compactPublicKey]) {
    pointersByPublicKey[compactPublicKey] = uint8ArrayLayerPointer
    const compactPublicKeys = Object.keys(pointersByPublicKey)
    publicKeysWatchers.forEach(f => f(compactPublicKeys))
  }
  return pointersByPublicKey[compactPublicKey]
}
const publicKeysWatchers = new Set()
export const watchPublicKeys = f => {
  publicKeysWatchers.add(f)
  f(Object.keys(pointersByPublicKey))
}
export const unwatchPublicKeys = f => {
  publicKeysWatchers.delete(f)
}

export class Peer extends Upserter {
  /** @type {Object.<string, SourceObject> */
  sourceObjects = {}

  #updateSourceObjects = () => {
    const lastLayer = this.layerIndex
    const remoteWantSents = this.remoteExports.lookup()
    Object.keys(remoteWantSents ?? {}).forEach(compactPublicKey => {
      if (!this.sourceObjects[compactPublicKey]) {
        this.addSourceObject(compactPublicKey, 'added by remote')
      }
    })
    this.upsert(Object.fromEntries(Object.entries(this.sourceObjects).map(([compactPublicKey, sourceObject]) => {
      const pointer = pointersByPublicKey[compactPublicKey]
      /** @type {SourceObject|undefined} */
      const remoteState = this.remoteExports.lookup()?.[compactPublicKey]
      while (remoteState?.sent?.[pointer.layerIndex + 1]) {
        const address = remoteState.sent[pointer.layerIndex + 1]
        if (address) {
          try {
            pointer.append(this.remoteExports.lookup(address))
          } catch (e) {
            console.log(address)
            console.log(this.remoteExports.length)
            throw e
          }
        }
      }
      sourceObject.want = [[pointer.layerIndex + 1, Number.POSITIVE_INFINITY]]
      remoteState?.want?.forEach?.(([start, end]) => {
        while (start < end && sourceObject.sent[start] === undefined && pointer.layerIndex >= start) {
          sourceObject.sent[start] = this.upsert(pointer.getLayerAtIndex(start).uint8Array, getCodecs(KIND.OPAQUE))
          ++start
        }
      })
      return [
        compactPublicKey,
        sourceObject
      ]
    })))
    if (this.layerIndex > lastLayer + 1) this.collapseTo(lastLayer + 1)
  }

  constructor (
    name,
    recaller = peerRecaller,
    remoteExports = new Uint8ArrayLayerPointer(undefined, recaller, `${name}.remoteExports`)
  ) {
    super(name, recaller)
    this.remoteExports = remoteExports
    this.updateSourceObjects('initialize')
  }

  addSourceObject (
    compactPublicKey,
    msg = `${this.name}.addSourceObject(${compactPublicKey})`,
    pointer
  ) {
    pointer = setPointerByPublicKey(compactPublicKey, this.recaller, pointer)
    if (!this.sourceObjects[compactPublicKey]) {
      this.sourceObjects[compactPublicKey] = { msg, want: [], sent: [] }
      this.updateSourceObjects(msg)
    }
    return pointer
  }

  updateSourceObjects (name = 'updateSourceObjects called directly') {
    this.recaller.watch(name, this.#updateSourceObjects)
  }

  cleanup () {
    this.recaller.unwatch(this.#updateSourceObjects)
  }
}
