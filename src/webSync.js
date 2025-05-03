import express from 'express'
import { join, extname } from 'path'
import { manageCert } from './manageCert.js'
import { createServer as createHttpsServer } from 'https'
import { createServer as createHttpServer } from 'http'
import { WebSocketServer } from 'ws'
import { TurtleBranchMultiplexer } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleBranchMultiplexer.js'

/**
 * @typedef {import('../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
 */

/**
 * @param {number} port
 * @param {string} basePublicKey
 * @param {TurtleDB} turtleDB
 * @param {boolean} https
 * @param {boolean} insecure
 * @param {string} certpath
 */
export async function webSync (port, basePublicKey, turtleDB, https, insecure, certpath) {
  const app = express()
  // app.use((req, _res, next) => {
  //   console.log(req.method, req.url)
  //   next()
  // })
  app.use(async (req, res, next) => {
    const matchGroups = req.url.match(/\/(?<urlPublicKey>[0-9A-Za-z]{41,51})\/(?<relativePath>.*)$/)?.groups
    let type = extname(req.url)
    if (matchGroups) {
      let { urlPublicKey, relativePath } = matchGroups
      if (!relativePath.length || relativePath.endsWith('/')) {
        type = 'html'
        relativePath = `${relativePath}index.html`
      }
      const turtle = await turtleDB.summonBoundTurtleBranch(urlPublicKey)
      if (!turtle) return next()
      const body = turtle.lookup('document', 'value', 'fs', relativePath)
      if (!body) return next()
      res.type(type)
      res.send(body)
    } else if (req.url.match(/^\/$|^\/index.html?$/)) {
      // console.log(req.url)
      res.redirect(`/${basePublicKey}/`)
    } else {
      next()
    }
  })
  const fullpath = join(process.cwd(), basePublicKey)
  app.use(express.static(fullpath))

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
    ws.on('close', (code, reason) => console.log('connection closed', { code, reason }))
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
