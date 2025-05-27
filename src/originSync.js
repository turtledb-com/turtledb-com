import { createConnection } from 'net'
import { TurtleBranchMultiplexer } from '../cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleBranchMultiplexer.js'

export async function originSync (turtleDB, host, port) {
  let t = 100
  let connectionCount = 0
  while (true) {
    console.log('-- creating new origin connection')
    console.time('-- origin connection lifespan')
    const tbMux = new TurtleBranchMultiplexer(`origin_#${host}`, false, turtleDB)
    for (const publicKey of turtleDB.getPublicKeys()) {
      await tbMux.getTurtleBranchUpdater(tbMux.name, publicKey)
    }
    const tbMuxBinding = async (/** @type {TurtleBranchStatus} */ status) => {
      try {
        // console.log('tbMuxBinding about to get next', status.publicKey)
        const updater = await tbMux.getTurtleBranchUpdater(tbMux.name, status.publicKey, status.turtleBranch)
        console.log('updater about to await settle', updater.name, updater.turtleBranch.length)
        await updater.settle
        console.log('updater settled', updater.turtleBranch.length)
      } catch (error) {
        console.error(error)
      }
    }
    turtleDB.bind(tbMuxBinding)
    let _connectionCount
    try {
      const socket = createConnection(port, host)
      socket.on('connect', () => {
        ;(async () => {
          try {
            for await (const chunk of tbMux.makeReadableStream()) {
              if (socket.closed) break
              if (socket.write(chunk)) {
                // console.log('host outgoing data', chunk)
              } else {
                console.warn('socket failed to write')
                // break
              }
            }
          } catch (error) {
            console.error(error)
          }
        })()
        t = 100
        _connectionCount = ++connectionCount
        console.log('-- onopen', { _connectionCount })
      })
      const streamWriter = tbMux.makeWritableStream().getWriter()
      socket.on('data', buffer => {
        // console.log('host incoming data', buffer)
        streamWriter.write(buffer)
      })
      await new Promise((resolve, reject) => {
        socket.on('close', resolve)
        socket.on('error', reject)
      })
    } catch (error) {
      if (error?.code === 'ECONNREFUSED') {
        console.log('-- connection refused')
      } else {
        console.error(error)
        throw error
      }
    }
    tbMux.stop()
    turtleDB.unbind(tbMuxBinding)
    console.timeEnd('-- origin connection lifespan')
    t = Math.min(t, 2 * 60 * 1000) // 2 minutes max (unjittered)
    t = t * (1 + Math.random()) // exponential backoff and some jitter
    console.log(`-- waiting ${(t / 1000).toFixed(2)}s`)
    await new Promise(resolve => setTimeout(resolve, t))
  }
}
