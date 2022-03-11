import {Workspaces} from '@alinea/core'
import express from 'express'
import {
  createServer as createHttpServer,
  IncomingMessage,
  ServerResponse
} from 'http'
import jwt from 'jsonwebtoken'
import {Backend, BackendOptions} from './Backend'
import {createServerRouter} from './router/ServerRouter'
import {finishResponse} from './util/FinishResponse'

export type ServerOptions<T extends Workspaces> = {
  jwtSecret: string
} & BackendOptions<T>

export class Server<T extends Workspaces = Workspaces> extends Backend<T> {
  app = express()

  constructor(public options: ServerOptions<T>) {
    super(options)
    this.app.use(createServerRouter(this))
  }

  signToken(tokenData: string | object | Buffer): string {
    const {jwtSecret} = this.options
    return jwt.sign(tokenData, jwtSecret)
  }

  verifyToken<T>(token: string): T {
    const {jwtSecret} = this.options
    return jwt.verify(token, jwtSecret) as T
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
