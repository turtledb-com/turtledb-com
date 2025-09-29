import { logDebug, logError, logInfo } from './logger.js'

/**
 * @typedef {import('../turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
 */

export const defaultPublicKey = 'ctclduqytfepmxfpxe8561b8h75l4u5n2t3sxlrmfc889xjz57'

/**
 *
 * @param {URL} url
 * @param {string} address
 * @param {TurtleDB} turtleDB
 * @param {string} publicKey
 * @param {(href: string) => void} redirect
 * @param {(type: string, body: string) => void} reply
 */
export const handleRedirect = async (url, address, turtleDB, publicKey = defaultPublicKey, redirect, reply) => {
  const type = url.split('.').pop()
  if (url === '/') {
    return redirect(`/${publicKey}/index.html`)
  }
  try {
    let directories = url.split('/')
    if (directories[0] === '') directories.shift()
    else throw new Error('url must start with /')
    let urlPublicKey = publicKey
    if (/^[0-9A-Za-z]{41,51}$/.test(directories[0])) {
      urlPublicKey = directories.shift()
    }
    if (directories[directories.length - 1] === '') {
      directories[directories.length - 1] = 'index.html'
      return redirect(`/${urlPublicKey}/index.html`)
    }
    const unfilteredLength = directories.length
    directories = directories.filter(Boolean)
    if (unfilteredLength !== directories.length) {
      return redirect(`/${urlPublicKey}/${directories.join('/')}`)
    }
    const turtleBranch = await turtleDB.summonBoundTurtleBranch(urlPublicKey)
    const body = turtleBranch.lookupFile(directories.join('/'), false, +address)
    if (body) {
      return reply(type, body)
    } else {
      try {
        const configJson = turtleBranch.lookupFile('config.json')
        const packageJson = turtleBranch.lookupFile('package.json')
        if (configJson) {
          const config = JSON.parse(configJson)
          logInfo(() => console.log({ config }))
          const branchGroups = ['fsReadWrite', 'fsReadOnly']
          for (const branchGroup of branchGroups) {
            const branches = config[branchGroup]
            if (branches) {
              for (const { name, key } of branches) {
                if (name && key) {
                  if (directories[0] === name) {
                    return redirect(`/${key}/${directories.slice(1).join('/')}`)
                  }
                }
              }
            }
          }
        } else if (packageJson) {
          const aliases = JSON.parse(packageJson).turtle.aliases
          if (aliases && directories[0] === '__turtledb_aliases__') {
            directories.shift()
            const name = directories.shift()
            const key = aliases[name]
            if (key) {
              return redirect(`/${key}/${directories.join('/')}`)
            }
          }
        }
      } catch {
        logDebug(() => console.log('not found, no config', url.pathname))
      }
    }
  } catch (error) {
    logError(() => console.error(error))
  }
  return reply(type, null)
}
