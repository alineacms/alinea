import {createError, Hub, isError} from '@alinea/core'
import {Outcome} from '@alinea/core/Outcome'
import {Cursor} from '@alinea/store'
import {sqliteFormatter} from '@alinea/store/sqlite/SqliteFormatter'
import {Headers as WebHeaders, Request as WebRequest} from '@web-std/fetch'
import {decode} from 'base64-arraybuffer'
import busboy from 'busboy'
import compression from 'compression'
import cors from 'cors'
import {Request, Response, Router} from 'express'
import http from 'http'
import {TLSSocket} from 'node:tls'
import serverTiming from 'server-timing'
import type {Writable} from 'stream'
import type {Server} from '../Server'
import {parseBuffer, parseJson} from '../util/BodyParser'
import {createFetchRouter} from './FetchRouter'

function fromNodeRequest(request: http.IncomingMessage) {
  const headers = new WebHeaders()
  for (const key of Object.keys(request.headers)) {
    if (!(key in request.headers)) continue
    const value = request.headers[key]
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v)
      }
    } else {
      headers.set(key, value)
    }
  }
  const init: RequestInit = {
    method: request.method!,
    headers
  }
  const protocol =
    request.socket instanceof TLSSocket && request.socket.encrypted
      ? 'https'
      : 'http'
  const url = `${protocol}://${request.headers.host}${request.url}`
  if (request.method !== 'GET' && request.method !== 'HEAD')
    init.body = request as any
  return new WebRequest(url, init)
}
export async function writeReadableStreamToWritable(
  stream: ReadableStream,
  writable: Writable
) {
  let reader = stream.getReader()

  async function read() {
    let {done, value} = await reader.read()

    if (done) {
      writable.end()
      return
    }

    writable.write(value)

    await read()
  }

  try {
    await read()
  } catch (error: any) {
    writable.destroy(error)
    throw error
  }
}

async function apply(response: globalThis.Response, to: http.ServerResponse) {
  to.statusCode = response.status
  response.headers.forEach((value, key) => to.setHeader(key, value))
  if (response.body) await writeReadableStreamToWritable(response.body, to)
  else to.end()
}

export function createServerRouter(hub: Server) {
  const {auth, dashboardUrl} = hub.options
  const router = Router()
  router.use(serverTiming())
  router.use(compression({filter: () => true}))
  router.use(cors({origin: dashboardUrl}))
  if (auth) router.use(auth.router())
  const prefix = '(/*)?'
  const {handle} = createFetchRouter(hub)
  router.use(async (req, res, next) => {
    const request = fromNodeRequest(req)
    const result = await handle(request)
    if (result) await apply(result, res)
    else next()
  })
  return router
}

export function createServerRouter__(hub: Server) {
  const {auth, dashboardUrl} = hub.options
  const router = Router()
  router.use(serverTiming())
  router.use(compression({filter: () => true}))
  router.use(cors({origin: dashboardUrl}))
  if (auth) router.use(auth.router())
  const prefix = '(/*)?'
  function respond<T>(res: Response, outcome: Outcome<T>) {
    if (outcome.isFailure())
      res.status(isError(outcome.error) ? outcome.error.code : 500)
    res.json(outcome)
  }
  type Handler<T> = (req: Request, res: Response) => Promise<Outcome<T>>
  function handle<T>(
    handler: Handler<T>
  ): (req: Request, res: Response) => Promise<void> {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        return respond(res, await handler(req, res))
      } catch (e) {
        return respond(res, Outcome.Failure(e))
      }
    }
  }
  // Hub.entry
  router.get(
    prefix + Hub.routes.entry(':id'),
    handle(async (req, res) => {
      const id = req.params.id
      const svParam = req.query.stateVector
      const stateVector =
        typeof svParam === 'string'
          ? new Uint8Array(decode(svParam))
          : undefined
      res.startTime('entry', 'Entry metric')
      const result = await hub.entry(id, stateVector)
      res.endTime('entry')
      return result
    })
  )
  // Hub.query
  router.post(
    prefix + Hub.routes.query(),
    handle(async (req, res) => {
      const fromSource = 'source' in req.query
      const body = await parseJson(req)
      res.header(
        'x-query',
        sqliteFormatter.formatSelect(body, {formatInline: true}).sql
      )
      res.startTime('query', 'Query metric')
      const result = await hub.query(new Cursor(body), {source: fromSource})
      res.endTime('query')
      return result
    })
  )
  // Hub.listDrafts
  router.get(
    prefix + Hub.routes.drafts(),
    handle(async (req, res) => {
      const workspace = req.query.workspace as string
      const result = await hub.listDrafts(workspace)
      return result
    })
  )
  // Hub.updateDraft
  router.put(
    prefix + Hub.routes.draft(':id'),
    handle(async (req, res) => {
      const id = req.params.id
      const body = (await parseBuffer(req)) as Buffer
      res.startTime('update', 'Update metric')
      const result = await hub.updateDraft(id, body)
      res.endTime('update')
      return result
    })
  )
  // Hub.deleteDraft
  router.delete(
    prefix + Hub.routes.draft(':id'),
    handle(async (req, res) => {
      const id = req.params.id
      res.startTime('delete', 'Delete metric')
      const result = await hub.deleteDraft(id)
      res.endTime('delete')
      return result
    })
  )
  // Hub.publishEntries
  router.post(
    prefix + Hub.routes.publish(),
    handle(async (req, res) => {
      const entries = await parseJson(req)
      res.startTime('publish', 'Publish metric')
      const result = await hub.publishEntries(entries)
      res.endTime('publish')
      return result
    })
  )
  // Hub.uploadFile
  router.post(
    prefix + Hub.routes.upload(),
    handle(async (req, res) => {
      const bb = busboy({headers: req.headers})
      let workspace: string | undefined, root: string | undefined
      const {path, buffer, preview, averageColor, blurHash, width, height} =
        await new Promise<Partial<Hub.Upload>>(resolve => {
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
            if (name === 'averageColor') res.averageColor = value
            if (name === 'blurHash') res.blurHash = value
            if (name === 'width') res.width = Number(value)
            if (name === 'height') res.height = Number(value)
          })
          bb.on('close', () => resolve(res))
          req.pipe(bb)
        })
      if (!workspace) throw createError(400, 'missing workspace')
      if (!root) throw createError(400, 'missing root')
      if (!path) throw createError(400, 'missing path')
      if (!buffer) throw createError(400, 'missing file')
      res.startTime('upload', 'Upload metric')
      const result = await hub.uploadFile(workspace, root, {
        buffer,
        path,
        preview,
        averageColor,
        blurHash,
        width,
        height
      })
      res.endTime('upload')
      return result
    })
  )
  return router
}
