import {Api, Auth, Hub} from '@alinea/core'
import cors from 'cors'
import express, {Router} from 'express'
import {createServer, IncomingMessage, ServerResponse} from 'http'
import {Socket} from 'net'
import Websocket, {WebSocketServer} from 'ws'
import {parseJson} from './util/BodyParser'
import {finishResponse} from './util/FinishResponse'

export type ServerOptions<T = any> = {
  dashboardUrl: string
  auth?: Auth.Server
  hub: Hub<T>
  transformPreview?: (entry: T) => any
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
      async (req, res) => {
        const id = req.params.id
        const body = await parseJson(req)
        res.json(await hub.content.putDraft(id, body.doc))
      }
    )
    router.post(prefix + Api.nav.content.publish(), async (req, res) => {
      const entries = await parseJson(req)
      res.json(await hub.content.publish(entries))
    })
    router.get('*', async (req, res) => {
      res.status(404).json({error: 'Not found'})
    })
    this.app.use(router)
    //const docServer = new DocServer(this.options.hub)
    //this.wss.on('connection', docServer.connect)
  }

  respond = (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    this.app(req, res)
    // Next.js expects us to return a promise that resolves when we're finished
    // with the response.
    return finishResponse(res)
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
