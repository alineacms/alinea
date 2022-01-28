import {Hub, isError} from '@alinea/core'
import {Outcome} from '@alinea/core/Outcome'
import {decode} from 'base64-arraybuffer'
import cors from 'cors'
import {Response, Router} from 'express'
import type {Server} from '../Server'
import {parseBuffer, parseJson} from '../util/BodyParser'

export function createServerRouter(hub: Server) {
  const {auth, dashboardUrl} = hub.options
  const router = Router()
  // Use of compression here results in a failure in nextjs.
  // api-utils apiRes.end is called with [undefined, undefined]
  // for etag (empty body) responses.
  // router.use(compression({filter: () => true}))
  router.use(cors({origin: dashboardUrl}))
  if (auth) router.use(auth.router())
  const prefix = '(/*)?'
  function respond<T>(res: Response, outcome: Outcome<T>) {
    if (outcome.isFailure())
      res.status(isError(outcome.error) ? outcome.error.code : 500)
    res.json(outcome)
  }
  // Hub.entry
  router.get(prefix + Hub.routes.entry(':id'), async (req, res) => {
    const id = req.params.id
    const svParam = req.query.stateVector
    const stateVector =
      typeof svParam === 'string' ? new Uint8Array(decode(svParam)) : undefined
    return respond(res, await hub.entry(id, stateVector))
  })
  // Hub.list
  router.get(
    [prefix + Hub.routes.list(':parentId'), prefix + Hub.routes.list()],
    async (req, res) => {
      const parentId = req.params.parentId
      return respond(res, await hub.list(parentId))
    }
  )
  // Hub.updateDraft
  router.put(prefix + Hub.routes.draft(':id'), async (req, res) => {
    const id = req.params.id
    const body = (await parseBuffer(req)) as Buffer
    return respond(res, await hub.updateDraft(id, body))
  })
  // Hub.deleteDraft
  router.delete(prefix + Hub.routes.draft(':id'), async (req, res) => {
    const id = req.params.id
    return respond(res, await hub.deleteDraft(id))
  })
  // Hub.publishEntries
  router.post(prefix + Hub.routes.publish(), async (req, res) => {
    const entries = await parseJson(req)
    return respond(res, await hub.publishEntries(entries))
  })
  return router
}
