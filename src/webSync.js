import express from 'express'
import { join, extname } from 'path'
import { manageCert } from './manageCert.js'
import { createServer as createHttpsServer } from 'https'
import { createServer as createHttpServer } from 'http'
import { WebSocketServer } from 'ws'
import { TurtleBranchMultiplexer } from '../public/js/turtle/connections/TurtleBranchMultiplexer.js'

/**
 * @typedef {import('../public/js/turtle/connections/TurtleDB.js').TurtleDB} TurtleDB
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
      res.set('Content-Type', 'text/html')
      res.send(
`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ALL YOUR TURTLE ARE BELONG TO US.</title>
    <base href="${basePublicKey}/"/>
    <script type="module" src="index.js"></script>
    <link rel="manifest" href="index.webmanifest" />
    <link rel="icon" href="tinker.svg" />
  </head>

  <body style="margin: 0; background: dimgray;">
    <p>
      loading the turtle that will load the turtles that will load the
      turtles...
    </p>
  </body>
</html>
`
      )
    } else {
      next()
    }
  })
  const fullpath = join(process.cwd(), 'public')
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
    const tbMux = new TurtleBranchMultiplexer(`server-tbMux-to-ws#${connectionCount}`, true, turtleDB)
    const startOutgoingLoop = async () => {
      for await (const u8aTurtle of tbMux.outgoingBranch.u8aTurtleGenerator()) {
        if (ws.readyState !== ws.OPEN) break
        const update = u8aTurtle.lookup()
        if (update?.publicKey) {
          await tbMux.getTurtleBranchUpdater(update.name, update.publicKey)
        }
        ws.send(u8aTurtle.uint8Array)
      }
    }
    startOutgoingLoop()
    const startIncomingLoop = async () => {
      for await (const u8aTurtle of tbMux.incomingBranch.u8aTurtleGenerator()) {
        if (ws.readyState !== ws.OPEN) break
        const update = u8aTurtle.lookup()
        if (update?.publicKey) {
          await tbMux.getTurtleBranchUpdater(update.name, update.publicKey)
        }
      }
    }
    startIncomingLoop()
    ws.on('message', buffer => tbMux.incomingBranch.append(new Uint8Array(buffer)))
    ws.on('close', (code, reason) => console.log('connection closed', { code, reason }))
    ws.on('error', error => console.error('connection error', { name: error.name, message: error.message }))
    await new Promise((resolve, reject) => {
      ws.onclose = resolve
      ws.onerror = reject
    })
    tbMux.stop()
  })

  server.listen(port, () => {
    console.log(`webserver started: ${(https || insecure) ? 'https' : 'http'}://localhost:${port}`)
  })
}
