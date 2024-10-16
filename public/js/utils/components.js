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

export const componentAtPath = (relativePath, cpks, baseElement) => {
  return _element => {
    if (typeof cpks === 'function') cpks = cpks()
    if (!Array.isArray(cpks)) cpks = [cpks]
    for (let cpk of cpks) {
      if (typeof cpk === 'function') cpk = cpk()
      const elementName = componentNameAtPath(relativePath, cpk)
      console.log('componentAtPath', { relativePath, cpk, elementName })
      if (elementName) {
        if (baseElement) return h`<${baseElement} is=${elementName} />`
        return h`<${elementName} />`
      }
    }
    return 'loading...'
  }
}

export const componentNameAtPath = (relativePath, cpk) => {
  const turtle = setPointerByPublicKey(cpk)
  const fsRefs = turtle.lookupRefs(turtle.getCommitAddress(), 'value', 'fs')
  if (!fsRefs) return
  const address = fsRefs[relativePath]
  if (address === undefined) return
  const elementName = buildElementName(relativePath, address, cpk)
  return elementName
}

export const deriveDefaults = url => {
  const parsedURL = new URL(url)
  const address = parsedURL.searchParams.get('address')
  const cpk = parsedURL.searchParams.get('cpk')
  const pointer = setPointerByPublicKey(cpk)
  const recaller = pointer.recaller
  const elementName = buildElementName(parsedURL.pathname, address, cpk)
  return { parsedURL, address, cpk, pointer, recaller, elementName }
}

export const parseLocation = () => ({ hash: window.location?.hash?.slice?.(1) })

const hashStateByRecaller = new Map()
export const useHash = recaller => {
  if (!hashStateByRecaller.has(recaller)) {
    let hash
    const setCpk = newHash => {
      if (hash === newHash) return
      hash = newHash
      window.history.pushState({}, '', hash ? `#${hash}` : '')
      recaller.reportKeyMutation(recaller, 'hash', 'setCpk', 'window.location')
    }
    const getCpk = () => {
      recaller.reportKeyAccess(recaller, 'hash', 'getCpk', 'window.location')
      return parseLocation().hash
    }
    const updateHashState = () => {
      setCpk(parseLocation().hash)
    }
    window.addEventListener('hashchange', () => updateHashState())
    updateHashState()
    hashStateByRecaller.set(recaller, { setCpk, getCpk, updateHashState })
  }
  return hashStateByRecaller.get(recaller)
}
