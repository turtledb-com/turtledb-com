import express from 'express'
import { join } from 'path'
import { manageCert } from './manageCert.js'
import { createServer as createHttpsServer } from 'https'
import { createServer as createHttpServer } from 'http'
import { WebSocketServer } from 'ws'
import { TurtleBranchMultiplexer } from '../branches/cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleBranchMultiplexer.js'
import { randomUUID } from 'crypto'

/**
 * @typedef {import('../branches/cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
 */

const uuid = randomUUID()

/**
 * @param {number} port
 * @param {string} basePublicKey
 * @param {TurtleDB} turtleDB
 * @param {boolean} https
 * @param {boolean} insecure
 * @param {string} certpath
 * @param {string} fallback
 */
export async function webSync (port, basePublicKey, turtleDB, https, insecure, certpath, fallback) {
  console.log('webSync')
  const root = join(process.cwd(), basePublicKey)
  const app = express()
  app.use((req, _res, next) => {
    console.log(req.method, req.url, req.originalUrl)
    next()
  })
  app.use(async (req, res, next) => {
    if (req.url === '/.well-known/appspecific/com.chrome.devtools.json') {
      res.type('application/json')
      res.send(JSON.stringify({ workspace: { uuid, root } }))
      return
    }
    const url = new URL(req.url, 'https://turtledb.com')
    const { pathname, searchParams } = url
    if (pathname === '/') {
      res.redirect(301, `/${basePublicKey}/index.html`)
      return
    }
    const matchGroups = pathname.match(/\/(?<urlPublicKey>[0-9A-Za-z]{41,51})(?<slash>\/?)(?<relativePath>.*)$/)?.groups
    try {
      const { urlPublicKey, slash, relativePath } = matchGroups ?? { urlPublicKey: fallback || basePublicKey, slash: '/', relativePath: pathname.slice(1) }
      const isDir = !relativePath || relativePath.endsWith('/')
      if (!slash) {
        url.pathname = `/${urlPublicKey}/${relativePath}`
      }
      if (isDir) {
        url.pathname = `${url.pathname}index.html`
      }
      if (!slash || isDir) {
        // fetchEvent.respondWith(Response.redirect(url.toString(), 301))
        res.redirect(301, url.toString())
      } else {
        const type = pathname.split('.').pop()
        const turtleBranch = await turtleDB.summonBoundTurtleBranch(urlPublicKey)
        const address = +searchParams.get('address')
        const body = address ? turtleBranch.lookup(address) : turtleBranch?.lookup?.('document', 'value', relativePath)
        if (body) {
          res.type(type)
          res.send(body)
        } else {
          try {
            const configJson = JSON.parse(turtleBranch?.lookup?.('document', 'value', 'config.json'))
            console.log({ configJson })
            const branchGroups = ['fsReadWrite', 'fsReadOnly']
            for (const branchGroup of branchGroups) {
              const branches = configJson[branchGroup]
              if (branches) {
                console.log(branches)
                for (const { name, key } of branches) {
                  if (name && key) {
                    const nickname = `/${urlPublicKey}/${name}/`
                    if (pathname.startsWith(nickname)) {
                      url.pathname = `/${key}/${pathname.slice(nickname.length)}`
                      return res.redirect(301, url.toString())
                    }
                  }
                }
              }
            }
          } catch {
            console.log('not found, no config', pathname)
          }
          next()
        }
      }
    } catch (error) {
      console.error(error)
    }
  })
  // app.use(express.static(root))

  let server
  if (https || insecure) {
    if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    const fullcertpath = join(process.cwd(), certpath)
    const certOptions = await manageCert(fullcertpath)
    server = createHttpsServer(certOptions, app)
  } else {
    server = createHttpServer(app)
  }

  const wss = new WebSocketServer({ server })
  let connectionCount = 0

  wss.on('connection', async ws => {
    ++connectionCount
    const _connectionCount = connectionCount
    console.log('new connection', _connectionCount)
    // keep alive
    const intervalId = setInterval(() => {
      if (_connectionCount !== connectionCount) clearInterval(intervalId)
      else ws.send(new Uint8Array())
    }, 20000)
    const tbMux = new TurtleBranchMultiplexer(`ws_connection_#${connectionCount}`, true, turtleDB)
    ;(async () => {
      for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
        if (ws.readyState !== ws.OPEN) break
        ws.send(u8aTurtle.uint8Array)
      }
    })()
    ws.on('message', buffer => tbMux.incomingBranch.append(new Uint8Array(buffer)))
    ws.on('close', (code, reason) => console.log('connection closed', _connectionCount))
    ws.on('error', error => console.error('connection error', { name: error.name, message: error.message }))
    await new Promise((resolve, reject) => {
      ws.onclose = resolve
      ws.onerror = reject
    })
    clearInterval(intervalId)
    tbMux.stop()
  })

  server.listen(port, () => {
    console.log(`webserver started: ${(https || insecure) ? 'https' : 'http'}://localhost:${port}`)
  })
}
