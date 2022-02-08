import {createError, Hub, isError} from '@alinea/core'
import {Outcome} from '@alinea/core/Outcome'
import {decode} from 'base64-arraybuffer'
import busboy from 'busboy'
import compression from 'compression'
import cors from 'cors'
import {Response, Router} from 'express'
import {Cursor} from 'helder.store'
import type {Server} from '../Server'
import {parseBuffer, parseJson} from '../util/BodyParser'

export function createServerRouter(hub: Server) {
  const {auth} = hub.options
  const {dashboardUrl} = hub.config.options
  const router = Router()
  // Use of compression here results in a failure in nextjs.
  // api-utils apiRes.end is called with [undefined, undefined]
  // for etag (empty body) responses.
  router.use(compression({filter: () => true}))
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
    [
      prefix + Hub.routes.list(':workspace', ':root', ':parentId'),
      prefix + Hub.routes.list(':workspace', ':root')
    ],
    async (req, res) => {
      const workspace = req.params.workspace
      const root = req.params.root
      const parentId = req.params.parentId
      return respond(res, await hub.list(workspace, root, parentId))
    }
  )
  // Hub.query
  router.post(prefix + Hub.routes.query(), async (req, res) => {
    const body = await parseJson(req)
    return respond(res, await hub.query(Cursor.fromJSON(body)))
  })
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
  // Hub.uploadFile
  router.post(prefix + Hub.routes.upload(), async (req, res) => {
    const bb = busboy({headers: req.headers})
    let workspace: string | undefined, root: string | undefined
    const {path, buffer, preview, color} = await new Promise<
      Partial<Hub.Upload>
    >(resolve => {
      const res: Partial<Hub.Upload> = {}
      bb.on('file', (name, file) => {
        if (name === 'buffer') {
          const chunks: Array<Buffer> = []
          file
            .on('data', data => chunks.push(data))
            .on('close', () => (res.buffer = Buffer.concat(chunks)))
        } else {
          file.resume()
        }
      })
      bb.on('field', (name, value) => {
        if (name === 'workspace') workspace = value
        if (name === 'root') root = value
        if (name === 'path') res.path = value
        if (name === 'preview') res.preview = value
        if (name === 'color') res.color = value
      })
      bb.on('close', () => resolve(res))
      req.pipe(bb)
    })
    if (!workspace) throw createError(400, 'missing workspace')
    if (!root) throw createError(400, 'missing root')
    if (!path) throw createError(400, 'missing path')
    if (!buffer) throw createError(400, 'missing file')
    return respond(
      res,
      await hub.uploadFile(workspace, root, {buffer, path, preview, color})
    )
  })
  return router
}
