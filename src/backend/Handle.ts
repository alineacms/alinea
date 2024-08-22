import {CMS} from 'alinea/core/CMS'
import {EntryPhase} from 'alinea/core/EntryRow'
import {ResolveRequest} from 'alinea/core/Resolver'
import {Realm} from 'alinea/core/pages/Realm'
import {Selection} from 'alinea/core/pages/ResolveData'
import {Type, enums, object, string} from 'cito'
import {Backend, RequestContext} from './Backend.js'

const ResolveBody: Type<ResolveRequest> = object({
  selection: Selection.adt,
  realm: enums(Realm).optional,
  locale: string.optional,
  preview: object({
    entryId: string,
    contentHash: string,
    phase: enums(EntryPhase),
    update: string.optional
  }).optional
})

export interface Handle {
  (request: Request, context: RequestContext): Promise<Response>
}

export function createHandle(cms: CMS, backend: Backend) {
  return async (
    request: Request,
    context: RequestContext
  ): Promise<Response> => {
    const url = new URL(request.url)
    const params = url.searchParams
    if (params.has('auth')) return backend.auth(context, request)
    const isJson = request.headers
      .get('content-type')
      ?.includes('application/json')
    if (!isJson) return new Response('Expected JSON', {status: 400})
    const body = await request.json()
    if (params.has('resolve'))
      return Response.json(backend.resolve(context, ResolveBody(body)))
    if (params.has('sync') && request.method === 'GET')
      return Response.json(backend.pendingSince(context, body.commitHash))
  }
}
/*
function createRouter(
  cms: CMS,
  backend: Backend
) {

  const matcher = router.queryMatcher
  return router(
    matcher
      .post(Connection.routes.previewToken())
      .map(router.parseJson)
      .map(({body}) => {
        const api = createApi(ctx)
        const request = PreviewBody(body)
        return ctx.logger.result(api.previewToken(request))
      })
      .map(respond),

    // History

    matcher
      .get(Connection.routes.revisions())
      .map(context)
      .map(({ctx, url}) => {
        const api = createApi(ctx)
        const file = url.searchParams.get('file')!
        const revisionId = url.searchParams.get('revisionId')
        return ctx.logger.result<any>(
          revisionId ? api.revisionData(file, revisionId) : api.revisions(file)
        )
      })
      .map(respond),

    matcher
      .post(Connection.routes.resolve())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        // This validates the input, and throws if it's invalid
        const api = createApi(ctx)
        return ctx.logger.result(api.resolve(ResolveBody(body)))
      })
      .map(respond),

    // Target

    matcher
      .post(Connection.routes.mutate())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        const api = createApi(ctx)
        if (!Array.isArray(body)) throw new Error('Expected array')
        // Todo: validate mutations properly
        return ctx.logger.result(api.mutate(body))
      })
      .map(respond),

    // Syncable

    matcher
      .get(Connection.routes.sync())
      .map(context)
      .map(({ctx, url}) => {
        const api = createApi(ctx)
        const contentHash = url.searchParams.get('contentHash')!
        return ctx.logger.result(api.syncRequired(contentHash))
      })
      .map(respond),

    matcher
      .post(Connection.routes.sync())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        const api = createApi(ctx)
        if (!Array.isArray(body)) throw new Error(`Array expected`)
        const contentHashes = body as Array<string>
        return ctx.logger.result(api.sync(contentHashes))
      })
      .map(respond),

    // Media

    matcher
      .post(Connection.routes.prepareUpload())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        const api = createApi(ctx)
        const {filename} = PrepareBody(body)
        return ctx.logger.result(api.prepareUpload(filename))
      })
      .map(respond),

    // Drafts

    matcher
      .get(Connection.routes.draft())
      .map(context)
      .map(({ctx, url}) => {
        const api = createApi(ctx)
        const entryId = url.searchParams.get('entryId')!
        return ctx.logger.result(
          api.getDraft(entryId).then(draft => {
            if (!draft) return null
            return {...draft, draft: base64.stringify(draft.draft)}
          })
        )
      })
      .map(respond),

    matcher
      .post(Connection.routes.draft())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        const api = createApi(ctx)
        const data = body as DraftTransport
        const draft = {...data, draft: new Uint8Array(base64.parse(data.draft))}
        return ctx.logger.result(api.storeDraft(draft))
      })
      .map(respond)
  ).recover(router.reportError)
}
*/
