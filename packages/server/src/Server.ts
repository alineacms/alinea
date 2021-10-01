import {Api, Hub} from '@alinea/core'
import compression from 'compression'
import cors from 'cors'
import express, {Router} from 'express'
import {IncomingMessage, ServerResponse} from 'http'
import {Socket} from 'net'
import Websocket, {WebSocketServer} from 'ws'
import {DocServer} from './ws/DocServer'

export class Server {
  app = express()
  wss = new WebSocketServer({noServer: true})

  constructor(public hub: Hub) {
    const router = Router()
    router.use(compression())
    router.use(cors())
    router.get(Api.nav.content.get('*'), async (req, res) => {
      const path = req.params['0']
      res.json(await hub.content.get(path))
    })
    router.get(Api.nav.content.list('*'), async (req, res) => {
      const parent = req.params['0'] ? req.params['0'] : undefined
      res.json(await hub.content.list(parent))
    })
    router.get('*', async (req, res) => {
      res.json({status: 404})
    })
    this.app.use(router)
    const docServer = new DocServer(hub)
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
}
