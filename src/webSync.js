import express from 'express'
import { join, extname } from 'path'
import { manageCert } from './manageCert.js'
import { createServer as createHttpsServer } from 'https'
import { createServer as createHttpServer } from 'http'
import { WebSocketServer } from 'ws'
import { TurtleBranchMultiplexer } from '../public/js/turtle/connections/TurtleBranchMultiplexer.js'

export async function webSync (port, signer, base, turtleRegistry, https, insecure, certpath) {
  const app = express()
  app.use((req, _res, next) => {
    console.log(req.method, req.url)
    next()
  })
  const basekey = await signer.makeKeysFor(base)
  app.use((req, res, next) => {
    const matchGroups = req.url.match(/\/(?<publiKey>[0-9A-Za-z]{41,51})\/(?<relativePath>.*)$/)?.groups
    const type = extname(req.url)
    if (matchGroups) {
      const { publiKey, relativePath } = matchGroups
      const turtle = turtleRegistry[publiKey]
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
    <base href="${basekey.publicKey}/"/>
    <script type="module" src="index.js"></script>
    <link rel="manifest" href="index.webmanifest" />
    <link rel="icon" href="svg/tinker.svg" />
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
  // const recaller = new Recaller('webserver')
  // let count = 0

  wss.on('connection', ws => {
    console.log('new connection attempt')
    const tbMux = new TurtleBranchMultiplexer('server tbMux to ws')
    tbMux.getTurtleBranchUpdater('public', basekey.publicKey, turtleRegistry[basekey.publicKey])
    ws.on('message', buffer => tbMux.incomingBranch.append(new Uint8Array(buffer)))
    let lastIndex = -1
    tbMux.recaller.watch('webclient tbMux to ws', () => {
      while (tbMux.outgoingBranch.index > lastIndex) {
        ++lastIndex
        ws.send(tbMux.outgoingBranch.u8aTurtle.getAncestorByIndex(lastIndex).uint8Array.buffer)
      }
    })
    /*
      const peer = new Peer(`[webserver.js to wss-connection#${count++}]`, recaller)
      const connectionCycle = (receive, setSend) => new Promise((resolve, reject) => {
        ws.on('message', buffer => receive(new Uint8Array(buffer)))
        ws.onclose = resolve
        ws.onerror = reject
        setSend(uint8Array => ws.send(uint8Array.buffer))
      })
      attachPeerToCycle(peer, connectionCycle)
      */
  })

  server.listen(port, () => {
    console.log(`webserver started: ${(https || insecure) ? 'https' : 'http'}://localhost:${port}`)
  })
}
