import {Api, Hub} from '@alinea/core'
import express, {Router} from 'express'
import {IncomingMessage, ServerResponse} from 'http'
import cors from 'cors'
import compression from 'compression'

export function serve(hub: Hub) {
  const router = Router()
  router.use(compression())
  router.use(cors())
  router.get(Api.nav.content.get('*'), async (req, res) => {
    const path = '/' + req.params['0']
    res.json(await hub.content.get(path))
  })
  router.get(Api.nav.content.list('*'), async (req, res) => {
    const parent = req.params['0'] ? '/' + req.params['0'] : undefined
    res.json(await hub.content.list(parent))
  })
  router.get('*', async (req, res) => {
    res.json({status: 404})
  })
  const app = express()
  app.use(router)
  return (req: IncomingMessage, res: ServerResponse): void => app(req, res)
}
