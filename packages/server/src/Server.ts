import {Api, Auth, Hub} from '@alinea/core'
import bodyParser from 'body-parser'
import compression from 'compression'
import cors from 'cors'
import express, {Router} from 'express'
import {IncomingMessage, ServerResponse} from 'http'
import {Socket} from 'net'
import {nextTick} from 'process'
import Websocket, {WebSocketServer} from 'ws'
//import {DocServer} from './ws/DocServer'

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
    const prefix = '(/*)?'
    const router = Router()
    router.use(compression())
    router.use(cors({origin: dashboardUrl}))
    router.use((req, res, next) => {
      next()
    })
    if (auth) router.use(auth.router())
    router.get(prefix + Api.nav.content.get(':id'), async (req, res) => {
      const id = req.params.id
      res.json(await hub.content.get(id))
    })
    router.get(
      prefix + Api.nav.content.entryWithDraft(':id'),
      async (req, res) => {
        const id = req.params.id
        const result = await hub.content.entryWithDraft(id)
        res.json(result || null)
      }
    )
    router.get(
      [prefix + Api.nav.content.list('*'), prefix + Api.nav.content.list()],
      async (req, res) => {
        const parent = req.params['0'] ? req.params['0'] : undefined
        res.json(await hub.content.list(parent))
      }
    )
    router.put(
      prefix + Api.nav.content.entryWithDraft(':id'),
      bodyParser.json(),
      async (req, res) => {
        const id = req.params.id
        res.json(await hub.content.putDraft(id, req.body.doc))
      }
    )
    router.get('*', async (req, res) => {
      res.status(404).json({error: 'Not found'})
    })
    this.app.use(router)
    //const docServer = new DocServer(this.options.hub)
    //this.wss.on('connection', docServer.connect)
  }

  respond = (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    return new Promise(resolve => {
      res.on('finish', () => {
        nextTick(resolve)
      })
      this.app(req, res)
    })
  }

  upgrade = (req: IncomingMessage, socket: Socket, head: Buffer): void => {
    const handleAuth = (ws: Websocket) => {
      this.wss.emit('connection', ws, req)
    }
    this.wss.handleUpgrade(req, socket, head, handleAuth)
  }

  /*listen(port: number) {
    return createServer(this.respond).on('upgrade', this.upgrade).listen(port)
  }*/
}
