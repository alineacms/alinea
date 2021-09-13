import {Api, Hub} from '@alinea/core'
import express, {Router} from 'express'
import {IncomingMessage, ServerResponse} from 'http'
import cors from 'cors'

export function serve(hub: Hub) {
  const router = Router()
  router.use(cors())
  router.get(Api.nav.content.list(), async (req, res) => {
    res.json(await hub.content().list())
  })
  const app = express()
  app.use(router)
  return (req: IncomingMessage, res: ServerResponse): void => app(req, res)
}
