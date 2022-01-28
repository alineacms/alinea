import {Auth, Hub, isError, Outcome} from '@alinea/core'
import {decode} from 'base64-arraybuffer'
import cors from 'cors'
import express, {Response, Router} from 'express'
import {createServer, IncomingMessage, ServerResponse} from 'http'
import {parseBuffer, parseJson} from './util/BodyParser'
import {finishResponse} from './util/FinishResponse'

export type ServerOptions<T = any> = {
  dashboardUrl: string
  auth?: Auth.Server
  hub: Hub<T>
  transformPreview?: (entry: T) => any
}

function hubRoutes(hub: Hub, router: Router) {
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
    console.log(body)
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
}

export class Server {
  app = express()

  constructor(protected options: ServerOptions) {
    const {hub, dashboardUrl, auth} = options
    const router = Router()
    // Use of compression here results in a failure in nextjs.
    // api-utils apiRes.end is called with [undefined, undefined]
    // for etag (empty body) responses.
    // router.use(compression({filter: () => true}))
    router.use(cors({origin: dashboardUrl}))
    if (auth) router.use(auth.router())
    hubRoutes(hub, router)
    this.app.use(router)
  }

  respond = (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    this.app(req, res)
    // Next.js expects us to return a promise that resolves when we're finished
    // with the response.
    return finishResponse(res)
  }

  listen(port: number) {
    //.on('upgrade', this.upgrade)
    return createServer(this.respond).listen(port)
  }
}
