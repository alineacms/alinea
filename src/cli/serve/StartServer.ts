import http, {IncomingMessage, ServerResponse} from 'node:http'
import {Emitter, createEmitter} from '../util/Emitter.js'

type MessagePair = [IncomingMessage, ServerResponse]

export interface Server {
  port: number
  serve(until?: Promise<any>): AsyncIterable<MessagePair>
}

export async function startServer(port = 4500, attempt = 0): Promise<Server> {
  const messages = createEmitter<MessagePair>()
  function serve(...pair: MessagePair) {
    messages.emit(pair)
  }
  return new Promise((resolve, reject) => {
    const server = http.createServer(serve)
    server.on('error', reject)
    server.on('listening', () => resolve(server))
    server.on('close', () => messages.return())
    server.listen(port)
  })
    .then(() => ({
      port,
      async *serve(until?: Promise<void>) {
        until?.then(() => messages.cancel())
        try {
          yield* messages
        } catch (e) {
          if (e === Emitter.CANCELLED) return
          throw e
        }
      }
    }))
    .catch(err => {
      if (attempt > 10) throw err
      const incrementedPort = port + 1
      if (err.code === 'EADDRINUSE' && incrementedPort < 65535) {
        console.log(
          `> Port ${port} is in use, attempting ${incrementedPort} instead`
        )
        return startServer(incrementedPort, attempt++)
      }
      throw err
    })
}
