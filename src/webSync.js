import express from 'express'
import { join } from 'path'
import { manageCert } from './manageCert.js'
import { createServer as createHttpsServer } from 'https'
import { createServer as createHttpServer } from 'http'
import { WebSocketServer } from 'ws'
import { TurtleBranchMultiplexer } from '../public/js/turtle/connections/TurtleBranchMultiplexer.js'
import { randomUUID } from 'crypto'
import { logDebug, logInfo, logError } from '../public/js/utils/logger.js'
import { handleRedirect } from '../public/js/utils/handleRedirect.js'

/**
 * @typedef {import('../public/js/turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
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
  const root = join(process.cwd(), basePublicKey)
  const app = express()
  app.use((req, _res, next) => {
    logDebug(() => console.log(req.method, req.url, req.originalUrl))
    next()
  })
  app.use(async (req, res, next) => {
    if (req.url === '/.well-known/appspecific/com.chrome.devtools.json') {
      res.type('application/json')
      res.send(JSON.stringify({ workspace: { uuid, root } }))
      return
    }
    handleRedirect(req.url, +req.params.address, turtleDB, fallback || basePublicKey, href => {
      res.redirect(302, href)
    }, (type, body) => {
      if (!body) return next()
      res.type(type)
      res.send(body)
    })
  })
  // app.use(express.static(root))

  let server
  if (https) {
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
    logDebug(() => console.log('new connection', _connectionCount))
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
    ws.on('close', (code, reason) => logDebug(() => console.log('connection closed', _connectionCount)))
    ws.on('error', error => logError(() => console.error('connection error', { name: error.name, message: error.message })))
    await new Promise((resolve, reject) => {
      ws.onclose = resolve
      ws.onerror = reject
    })
    clearInterval(intervalId)
    tbMux.stop()
  })

  server.listen(port, () => {
    logInfo(() => console.log(`local webserver started: ${https ? 'https' : 'http'}://localhost:${port}

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!! FUN-FACT: Self-signed certificates break service-workers !!!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    (HINT): On MacOS and in a browser started with this command ──╮
               a service-worker can use a self-signed cert.       │
╭─────────────────────────────────────────────────────────────────╯
╰─▶ open '/Applications/Google Chrome Canary.app' --args --ignore-certificate-errors https://localhost:${port}/`))
  })
}
