import {Api, Auth, Hub} from '@alinea/core'
import bodyParser from 'body-parser'
import cors from 'cors'
import express, {Router} from 'express'
import {createServer, IncomingMessage, ServerResponse} from 'http'
import {Socket} from 'net'
import Websocket, {WebSocketServer} from 'ws'
//import {DocServer} from './ws/DocServer'

export type ServerOptions = {
  dashboardUrl: string
  auth?: Auth.Server
  hub: Hub
}

// Source: https://github.com/dougmoscrop/serverless-http/blob/f72fdeaa0d25844257e01ff1078585a92752f53a/lib/finish.js
function finish(res: ServerResponse) {
  return new Promise<void>((resolve, reject) => {
    if (res.writableEnded) return resolve()
    let finished = false
    function done(err?: Error) {
      if (finished) return
      finished = true
      res.removeListener('error', done)
      res.removeListener('end', done)
      res.removeListener('finish', done)
      if (err) reject(err)
      else resolve()
    }
    res.once('error', done)
    res.once('end', done)
    res.once('finish', done)
  })
}

export class Server {
  app = express()
  wss = new WebSocketServer({noServer: true})

  constructor(protected options: ServerOptions) {
    const {hub, dashboardUrl, auth} = options
    const prefix = '(/*)?'
    const router = Router()
    // Use of compression here results in a failure in nextjs.
    // api-utils apiRes.end is called with [undefined, undefined]
    // for etag (empty body) responses.
    // router.use(compression())
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
      [
        prefix + Api.nav.content.list(':parent'),
        prefix + Api.nav.content.list()
      ],
      async (req, res) => {
        const parent = req.params.parent
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
    this.app(req, res)
    return finish(res)
  }

  upgrade = (req: IncomingMessage, socket: Socket, head: Buffer): void => {
    const handleAuth = (ws: Websocket) => {
      this.wss.emit('connection', ws, req)
    }
    this.wss.handleUpgrade(req, socket, head, handleAuth)
  }

  listen(port: number) {
    //.on('upgrade', this.upgrade)
    return createServer(this.respond).listen(port)
  }
}
