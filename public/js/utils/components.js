import { b64ToUi8 } from '../dataModel/Committer.js'
import { h } from '../display/h.js'
import { setPointerByPublicKey } from '../net/Peer.js'

export const getCpkSlice = cpk => b64ToUi8(cpk).slice(0, 6).map(n => `0${n.toString(16)}`.slice(-2)).join('')
export const getBase = relativePath => relativePath.match(/(?<base>[^/]*)\.[^/]*$/)?.groups?.base

export const buildElementName = (relativePath, address, cpk) => {
  const base = getBase(relativePath)
  const cpkSlice = getCpkSlice(cpk)
  return `${base}-${cpkSlice}-${address}`
}

export const componentAtPath = (relativePath, cpk) => {
  return _element => {
    const turtle = setPointerByPublicKey(cpk)
    const fsRefs = turtle.lookupRefs(turtle.getCommitAddress(), 'value', 'fs')
    if (!fsRefs) return 'loading...'
    const address = fsRefs[relativePath]
    const elementName = buildElementName(relativePath, address, cpk)
    return h`<${elementName} />`
  }
}
