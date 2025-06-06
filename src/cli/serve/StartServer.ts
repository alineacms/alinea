import http, {type IncomingMessage, type ServerResponse} from 'node:http'
import type {Request, Response} from '@alinea/iso'
import {fromNodeRequest, respondTo} from 'alinea/backend/router/NodeHandler'
import {createEmitter} from '../util/Emitter.js'
import {reportWarning} from '../util/Report.js'

interface RequestEvent {
  request: Request
  respondWith(response: Response): Promise<void>
}

export interface Server {
  port: number
  serve(abortController?: AbortController): AsyncIterable<RequestEvent>
  close(): void
}

async function startBunServer(
  port = 4500,
  attempt = 0,
  silent = false
): Promise<Server> {
  const messages = createEmitter<RequestEvent>()
  try {
    const server = Bun.serve({
      port,
      fetch(request) {
        const {resolve, promise} = Promise.withResolvers<Response>()
        messages.emit({
          request,
          async respondWith(response) {
            resolve(response)
          }
        })
        return promise
      }
    })
    return {
      port,
      close() {
        server.stop()
      },
      async *serve(abortController?: AbortController) {
        if (abortController)
          abortController.signal.addEventListener(
            'abort',
            () => messages.return(),
            true
          )
        yield* messages
      }
    }
  } catch (err: any) {
    if (attempt > 10) throw err
    const incrementedPort = port + 1
    if (err.code === 'EADDRINUSE' && incrementedPort < 65535) {
      if (!silent)
        reportWarning(
          `Port ${port} is in use, attempting ${incrementedPort} instead`
        )
      return startBunServer(incrementedPort, attempt++, silent)
    }
    throw err
  }
}

async function startNodeServer(
  port = 4500,
  attempt = 0,
  silent = false
): Promise<Server> {
  const messages = createEmitter<RequestEvent>()
  function serve(incoming: IncomingMessage, outgoing: ServerResponse) {
    messages.emit({
      request: fromNodeRequest(incoming),
      respondWith(response) {
        return respondTo(outgoing, response)
      }
    })
  }
  return new Promise<http.Server>((resolve, reject) => {
    const server = http.createServer(serve)
    server.on('error', reject)
    server.on('listening', () => resolve(server))
    server.on('close', () => messages.return())
    server.listen(port)
  })
    .then((server: http.Server): Server => {
      return {
        port,
        close() {
          server.close()
        },
        async *serve(abortController?: AbortController) {
          if (abortController)
            abortController.signal.addEventListener(
              'abort',
              () => messages.return(),
              true
            )
          yield* messages
        }
      }
    })
    .catch(err => {
      if (attempt > 10) throw err
      const incrementedPort = port + 1
      if (err.code === 'EADDRINUSE' && incrementedPort < 65535) {
        if (!silent)
          reportWarning(
            `Port ${port} is in use, attempting ${incrementedPort} instead`
          )
        return startNodeServer(incrementedPort, attempt++, silent)
      }
      throw err
    })
}

export const startServer =
  'Bun' in globalThis ? startBunServer : startNodeServer
