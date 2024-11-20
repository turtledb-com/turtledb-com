import { KIND, getCodecs } from '../dataModel/CODECS.js'
import { Committer } from '../dataModel/Committer.js'
import { OWN_KEYS, Uint8ArrayLayerPointer } from '../dataModel/Uint8ArrayLayerPointer.js'
import { Upserter } from '../dataModel/Upserter.js'
import { Recaller } from '../utils/Recaller.js'
import { hashNameAndPassword } from '../utils/crypto.js'

/** @typedef {{sent: Array.<number>, want: Array.<[number, number]>}} SourceObject */

export const peerRecaller = new Recaller('Peer.js')

/** @type {Object.<string, Uint8ArrayLayerPointer>} */
const pointersByPublicKey = {}
export const getPointerByPublicKey = (
  compactPublicKey,
  recaller = peerRecaller,
  uint8ArrayLayerPointer = new Uint8ArrayLayerPointer(undefined, recaller, compactPublicKey)
) => {
  if (!compactPublicKey) throw new Error('compactPublicKey required')
  const existingPointer = pointersByPublicKey[compactPublicKey]
  if (!existingPointer) {
    recaller.reportKeyMutation(pointersByPublicKey, OWN_KEYS, 'getPointerByPublicKey', 'Peer.js')
    pointersByPublicKey[compactPublicKey] = uint8ArrayLayerPointer
    const compactPublicKeys = Object.keys(pointersByPublicKey)
    publicKeysWatchers.forEach(f => f(compactPublicKeys))
  } else if (uint8ArrayLayerPointer.privateKey && !(existingPointer instanceof Committer)) {
    pointersByPublicKey[compactPublicKey] = new Committer(
      Uint8ArrayLayerPointer.name,
      uint8ArrayLayerPointer.privateKey,
      recaller,
      existingPointer.uint8ArrayLayer
    )
  }
  recaller.reportKeyAccess(pointersByPublicKey, compactPublicKey, 'getPointerByPublicKey', 'Peer.js')
  if (existingPointer !== pointersByPublicKey[compactPublicKey]) {
    recaller.reportKeyMutation(pointersByPublicKey, compactPublicKey, 'getPointerByPublicKey', 'Peer.js')
  }
  return pointersByPublicKey[compactPublicKey]
}
export const getPublicKeys = (recaller = peerRecaller) => {
  recaller.reportKeyAccess(pointersByPublicKey, OWN_KEYS, 'getPublicKeys', 'Peer.js')
  return Object.keys(pointersByPublicKey)
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
    const lastLayer = this.layerIndex ?? -1
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
      while (remoteState?.sent?.[(pointer.layerIndex ?? -1) + 1]) {
        const address = remoteState.sent[(pointer.layerIndex ?? -1) + 1]
        if (address) {
          const data = this.remoteExports.lookup(address)
          pointer.append(data)
        }
      }
      sourceObject.want = [[(pointer.layerIndex ?? -1) + 1, Number.POSITIVE_INFINITY]]
      remoteState?.want?.forEach?.(([start, end]) => {
        while (start < end && sourceObject.sent[start] === undefined && (pointer.layerIndex ?? -1) >= start) {
          sourceObject.sent[start] = this.upsert(pointer.getLayerAtIndex(start).uint8Array, getCodecs(KIND.OPAQUE))
          ++start
        }
      })
      return [
        compactPublicKey,
        sourceObject
      ]
    })))
    if ((this.layerIndex ?? -1) > lastLayer + 1) this.collapseTo(lastLayer + 1)
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
    pointer = getPointerByPublicKey(compactPublicKey, this.recaller, pointer)
    if (!this.sourceObjects[compactPublicKey]) {
      this.sourceObjects[compactPublicKey] = { msg, want: [], sent: [] }
      this.updateSourceObjects(msg)
    }
    return pointer
  }

  async login (username, password, turtlename) {
    const hashword = await hashNameAndPassword(username, password)
    return this.hashwordLogin(this.hashwordLogin(hashword, turtlename))
  }

  async hashwordLogin (hashword, turtlename = 'home') {
    const privateKey = await hashNameAndPassword(turtlename, hashword)
    const committer = new Committer(turtlename, privateKey, this.recaller)
    const compactPublicKey = committer.compactPublicKey
    const originalCommitter = getPointerByPublicKey(compactPublicKey, this.recaller, committer, true)
    this.addSourceObject(
      compactPublicKey,
      `login created Committer ${turtlename}/${compactPublicKey}`
    )
    return originalCommitter
  }

  updateSourceObjects (name = 'updateSourceObjects called directly') {
    this.recaller.watch(name, this.#updateSourceObjects)
  }

  cleanup () {
    this.recaller.unwatch(this.#updateSourceObjects)
  }
}
