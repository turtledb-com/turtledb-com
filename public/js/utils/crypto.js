export const cryptoPromise = (typeof crypto === 'undefined') ? import('crypto') : crypto

export const hashNameAndPassword = async (username, password, iterations = 100000) => {
  const { subtle } = await cryptoPromise
  const passwordKey = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey'])
  const hashwordKey = await subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode(username), iterations, hash: 'SHA-256' },
    passwordKey,
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign']
  )
  return b2h(new Uint8Array(await subtle.exportKey('raw', hashwordKey)).slice(32))
}

const padh = (n, pad) => n.toString(16).padStart(pad, '0')
const b2h = (b) => Array.from(b).map(e => padh(e, 2)).join('') // bytes to hex
