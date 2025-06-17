import { createServer } from 'net'
import { TurtleBranchMultiplexer } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/turtle/connections/TurtleBranchMultiplexer.js'
import { logError, logWarn, logInfo } from '../branches/.cv6t981m0a2ou7fil4f88ujf6kpj2lojceycv1gdcq23wlzqi2/js/utils/logger.js'

export async function outletSync (turtleDB, port) {
  let connectionCount = 0
  const server = createServer(async socket => {
    let tbMux
    const _connectionCount = ++connectionCount
    try {
      logInfo(() => console.log('turtle connection', _connectionCount))
      tbMux = new TurtleBranchMultiplexer(`outlet_#${_connectionCount}`, true, turtleDB)
      ;(async () => {
        try {
          for await (const chunk of tbMux.makeReadableStream()) {
            if (socket.closed) break
            if (socket.write(chunk)) {
              // logDebug(() => console.log('origin.host outgoing data', chunk))
            } else {
              logWarn(() => console.warn('socket failed to write'))
              // break
            }
          }
        } catch (error) {
          logError(() => console.error(error))
        }
      })()
      const streamWriter = tbMux.makeWritableStream().getWriter()
      socket.on('data', buffer => {
        // logDebug(() => console.log('turtleHost incoming data', buffer))
        streamWriter.write(buffer)
      })

      await new Promise((resolve, reject) => {
        socket.on('close', resolve)
        socket.on('error', reject)
      })
    } catch (error) {
      if (error.code === 'ECONNRESET') {
        logWarn(() => console.warn('ECONNRESET', _connectionCount))
      } else {
        logError(() => console.error(error))
        throw error
      }
    }
    tbMux?.stop?.()
  })
  server.listen(port, () => {
    logInfo(() => console.log('opened outlet.port:', port))
  })
}
