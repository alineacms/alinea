import compression from 'compression'
import cors from 'cors'
import {Router} from 'express'
import serverTiming from 'server-timing'
import type {Server} from '../Server'
import {createFetchRouter} from './FetchRouter'
import {createNodeHandler} from './NodeHandler'

export function createServerRouter(hub: Server, base: string = '/') {
  const {auth, dashboardUrl} = hub.options
  const router = Router()
  router.use(serverTiming())
  router.use(compression({filter: () => true}))
  router.use(cors({origin: dashboardUrl}))
  if (auth) router.use(auth.router())
  const {handle} = createFetchRouter(hub, base)
  router.use(createNodeHandler(handle))
  return router
}
