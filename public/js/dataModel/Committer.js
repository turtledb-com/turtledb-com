import { Codec, getCodecs, KIND } from './CODECS.js'
import { signAsync, getPublicKey, verify } from '../utils/noble-secp256k1.js'
import { collapseUint8Arrays, Uint8ArrayLayer } from './Uint8ArrayLayer.js'
import { Upserter } from './Upserter.js'
import { cryptoPromise } from '../utils/crypto.js'
import { ADDRESS, getAddress, Uint8ArrayLayerPointer } from './Uint8ArrayLayerPointer.js'

export class Committer extends Uint8ArrayLayerPointer {
  constructor (name, privateKey, recaller, uint8ArrayLayer) {
    super(uint8ArrayLayer, recaller, name)
    this.privateKey = privateKey
    this.committedLength = uint8ArrayLayer?.length
    this.compactPublicKey = privateKeyToCompactPublic(privateKey)
    this.workspace = new Upserter(`${this.name}.workspace`, this.recaller, this.uint8ArrayLayer)
  }

  append (uint8Array) {
    this.workspace.append(uint8Array)
    this.uint8ArrayLayer = this.workspace.uint8ArrayLayer
    this.committedLength = this.uint8ArrayLayer.length
  }

  async commit (message, value) {
    return this.commitAddress(message, value?.[ADDRESS] || this.workspace.upsert(value))
  }

  async commitAddress (message, valueAddress) {
    const prev = this.lookup(this.getAddress(), getCodecs(KIND.REFS_OBJECT))
    if (prev && prev.value === valueAddress) {
      console.warn('no changes, failing commit', { message, valueAddress })
      return
    }
    this.workspace.upsert({
      name: this.workspace.upsert(this.name),
      compactPublicKey: this.workspace.upsert(this.compactPublicKey),
      message: this.workspace.upsert(message),
      ts: this.workspace.upsert(new Date()),
      value: valueAddress
    }, getCodecs(KIND.REFS_OBJECT))
    const layerIndex = this.committedLength && this.workspace.uint8ArrayLayer.getLayerContainingAddress(this.committedLength).layerIndex
    this.workspace.uint8ArrayLayer = this.workspace.uint8ArrayLayer.collapseTo(layerIndex)
    const uint8Arrays = [
      ...(layerIndex ? [this.workspace.uint8ArrayLayer.parent.uint8Array] : []),
      this.workspace.uint8ArrayLayer.uint8Array
    ]
    this.workspace.upsert(await this.sign(collapseUint8Arrays(...uint8Arrays)), getCodecs(KIND.OPAQUE))
    this.workspace.uint8ArrayLayer = this.workspace.uint8ArrayLayer.collapseTo(layerIndex)
    this.uint8ArrayLayer = this.workspace.uint8ArrayLayer
    this.committedLength = this.uint8ArrayLayer.length
    return this.uint8ArrayLayer.uint8Array
  }

  async sign (uint8Array) {
    const hash = await digestData(uint8Array)
    const signature = await signAsync(hash, this.privateKey)
    return signature.toCompactRawBytes()
  }

  static async verifySignedCommit (signedCommit, lastSignedCommit, publicKey) {
    const signatureAddress = signedCommit.length - 1
    const footer = signedCommit[signatureAddress]
    const opaqueCodec = Codec.calculateCodec(footer, getCodecs(KIND.OPAQUE))
    const signedCommitLayer = new Uint8ArrayLayer(signedCommit)
    const signature = opaqueCodec.decodeValue(signedCommitLayer, signatureAddress, footer)
    const commitEndInclusive = getAddress(signedCommitLayer, signatureAddress) + 1
    const newSignedSlice = signedCommit.slice(0, commitEndInclusive)
    const hash = await digestData(collapseUint8Arrays(lastSignedCommit, newSignedSlice))
    if (verify(signature, hash, b64ToUi8(publicKey))) {
      return commitEndInclusive
    } else {
      return undefined
    }
  }
}
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const b64Chars = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'
const baseToBMapping = Object.fromEntries(base64Chars.split('').map((c, i) => [c, b64Chars.charAt(i)]))
const bToBaseMapping = Object.fromEntries(b64Chars.split('').map((c, i) => [c, base64Chars.charAt(i)]))
const baseToB = str => str.split('').map(c => baseToBMapping[c]).join('')
const bToBase = str => str.split('').map(c => bToBaseMapping[c]).join('')

const privateKeyToCompactPublic = privateKey => ui8ToB64(getPublicKey(privateKey))
export const ui8ToB64 = ui8 => baseToB(btoa(String.fromCharCode.apply(null, ui8)))
export const b64ToUi8 = b64 => new Uint8Array(atob(bToBase(b64)).split('').map(c => c.charCodeAt(0)))

const digestData = async uint8Array => {
  const { subtle } = await cryptoPromise
  const digested = await subtle.digest('SHA-256', uint8Array)
  return new Uint8Array(digested)
}
