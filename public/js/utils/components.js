import { b64ToUi8 } from '../dataModel/Committer.js'
import { h } from '../display/h.js'
import { getPointerByPublicKey } from '../net/Peer.js'

export const getCpkSlice = cpk => b64ToUi8(cpk).slice(0, 6).map(n => `0${n.toString(16)}`.slice(-2)).join('')
export const getBase = relativePath => relativePath.match(/(?<base>[^/]*)\.[^/]*$/)?.groups?.base

export const buildElementName = (relativePath, address, cpk) => {
  const base = getBase(relativePath)
  const cpkSlice = getCpkSlice(cpk)
  return `${base}-${cpkSlice}-${address}`
}

export const componentAtPath = (relativePath, cpk, baseElement) => {
  console.log('relativePath', relativePath)
  const componentsByElementName = {}
  return (attributes = {}, children = []) => {
    if (typeof cpk === 'function') cpk = cpk()
    const elementName = componentNameAtPath(relativePath, cpk)
    // console.log('componentAtPath', { relativePath, cpk, elementName })
    if (elementName) {
      if (!componentsByElementName[elementName]) {
        if (baseElement) componentsByElementName[elementName] = h`<${baseElement} is=${elementName} ${attributes}>${children}</>`
        else componentsByElementName[elementName] = h`<${elementName} ${attributes}>${children}</>`
      }
      return componentsByElementName[elementName]
    }
    return 'loading...'
  }
}

export const componentNameAtPath = (relativePath, cpk) => {
  const turtle = getPointerByPublicKey(cpk)
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
  const pointer = getPointerByPublicKey(cpk)
  const recaller = pointer.recaller
  const elementName = buildElementName(parsedURL.pathname, address, cpk)
  return { parsedURL, address, cpk, pointer, recaller, elementName }
}

export const parseLocation = () => ({ hash: window.location?.hash?.slice?.(1) })

const hashStateByRecaller = new Map()
export const useHash = recaller => {
  if (!hashStateByRecaller.has(recaller)) {
    let hash = ''
    const setCpk = (newHash = '') => {
      if (hash === newHash) return
      console.log(parseLocation(), { hash, newHash })
      hash = newHash
      if (parseLocation().hash !== hash) {
        console.log('bumping history', parseLocation(), hash)
        window.history.pushState({}, '', `#${hash}`)
      }
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
