import {Api, Auth, Hub} from '@alinea/core'
import bodyParser from 'body-parser'
import compression from 'compression'
import cors from 'cors'
import express, {Router} from 'express'
import {createServer, IncomingMessage, ServerResponse} from 'http'
import {Socket} from 'net'
import Websocket, {WebSocketServer} from 'ws'
import {DocServer} from './ws/DocServer'

export type ServerOptions = {
  dashboardUrl: string
  auth?: Auth.Server
  hub: Hub
}

export class Server {
  app = express()
  wss = new WebSocketServer({noServer: true})

  constructor(protected options: ServerOptions) {
    const {hub, dashboardUrl, auth} = options
    const router = Router()
    router.use(compression())
    router.use(cors({origin: dashboardUrl}))
    if (auth) router.use(auth.router())
    router.get(Api.nav.content.get(':id'), async (req, res) => {
      const id = req.params.id
      res.json(await hub.content.get(id))
    })
    router.get(Api.nav.content.entryWithDraft(':id'), async (req, res) => {
      const id = req.params.id
      const result = await hub.content.entryWithDraft(id)
      res.json(result || null)
    })
    router.get(Api.nav.content.list('*'), async (req, res) => {
      const parent = req.params['0'] ? req.params['0'] : undefined
      res.json(await hub.content.list(parent))
    })
    router.put(
      Api.nav.content.entryWithDraft(':id'),
      bodyParser.json(),
      async (req, res) => {
        const id = req.params.id
        res.json(await hub.content.putDraft(id, req.body.doc))
      }
    )
    router.get('*', async (req, res) => {
      res.sendStatus(404)
    })
    this.app.use(router)
    const docServer = new DocServer(this.options.hub)
    this.wss.on('connection', docServer.connect)
  }

  respond = (req: IncomingMessage, res: ServerResponse): void =>
    this.app(req, res)

  upgrade = (req: IncomingMessage, socket: Socket, head: Buffer): void => {
    const handleAuth = (ws: Websocket) => {
      this.wss.emit('connection', ws, req)
    }
    this.wss.handleUpgrade(req, socket, head, handleAuth)
  }

  listen(port: number) {
    return createServer(this.respond).on('upgrade', this.upgrade).listen(port)
  }
}
