import {Auth, Workspaces} from '@alinea/core'
import express from 'express'
import {
  createServer as createHttpServer,
  IncomingMessage,
  ServerResponse
} from 'http'
import {Backend, BackendOptions} from './Backend'
import {createServerRouter} from './router/ServerRouter'
import {finishResponse} from './util/FinishResponse'

export type ServerOptions<T extends Workspaces> = {
  dashboardUrl: string
  auth?: Auth.Server
} & BackendOptions<T>

export class Server<T extends Workspaces = Workspaces> extends Backend<T> {
  app = express()

  constructor(public options: ServerOptions<T>) {
    super(options)
    this.app.use(createServerRouter(this))
  }

  respond = (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    this.app(req, res)
    // Next.js expects us to return a promise that resolves when we're finished
    // with the response.
    return finishResponse(res)
  }

  listen(port: number) {
    return createHttpServer(this.respond).listen(port)
  }
}

export function createServer<T extends Workspaces>(
  options: ServerOptions<T>
): Server<T> {
  return new Server(options)
}
