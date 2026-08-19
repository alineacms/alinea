import {JWTPreviews} from '#/backend/util/JWTPreviews.js'
import {CloudRemote} from '#/cloud/CloudRemote.js'
import type {Entry} from '#/core.js'
import type {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import type {ContentStateResponse} from '#/core/ContentSync.js'
import type {
  AuthedContext,
  DraftTransport,
  RemoteConnection,
  RequestContext
} from '#/core/Connection.js'
import type {LocalDB} from '#/core/db/LocalDB.js'
import type {DraftKey} from '#/core/Draft.js'
import type {GraphQuery} from '#/core/Graph.js'
import {ErrorCode, HttpError} from '#/core/HttpError.js'
import {assertUploadSize} from '#/core/media/UploadLimits.js'
import {Permission, Policy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import type {User, UserInput} from '#/core/User.js'
import {base64} from '#/core/util/Encoding.js'
import {isRecord} from '#/core/util/Objects.js'
import {array, number, object, optional, string} from 'cito'
import PLazy from 'p-lazy'
import {InvalidCredentialsError, MissingCredentialsError} from './Auth.js'
import {createContentState} from './ContentSync.js'
import {HandleAction} from './HandleAction.js'
import {createPreviewParser} from './resolver/ParsePreview.js'
import {createThrottledSync} from './util/Syncable.js'

const PrepareBody = object({
  filename: string,
  size: optional(number)
})

export interface Handler {
  (request: Request, context: RequestContext): Promise<Response>
}

export type HookResponse<T = void> = void | T | Promise<T> | Promise<void>

export interface HandlerHooks {
  beforeCreate?(entry: Entry): HookResponse<Entry>
  afterCreate?(entry: Entry): HookResponse
  beforeUpdate?(entry: Entry): HookResponse<Entry>
  afterUpdate?(entry: Entry): HookResponse
  beforeArchive?(entryId: string): HookResponse
  afterArchive?(entryId: string): HookResponse
  beforeRemove?(entryId: string): HookResponse
  afterRemove?(entryId: string): HookResponse
}

export interface HandlerOptions extends HandlerHooks {
  cms: CMS
  db: LocalDB | Promise<LocalDB>
  remote?: (context: RequestContext) => RemoteConnection
  release?: {
    configId: string
    adminPath: string
  }
}

export function createHandler({
  cms,
  remote = context => new CloudRemote(context, cms.config),
  db,
  release,
  ...hooks
}: HandlerOptions): Handler {
  const configId = release?.configId ?? process.env.ALINEA_CONFIG_ID
  const adminPath =
    release?.adminPath ??
    process.env.ALINEA_ADMIN_PATH ??
    Config.adminPath(cms.config)
  const throttle = createThrottledSync()
  const contentStates = new Map<
    string,
    {sourceSha: string; result: ContentStateResponse}
  >()
  const previewParser = PLazy.from(async () => {
    const local = await db
    return createPreviewParser(local)
  })
  return async function handle(
    request: Request,
    context: RequestContext
  ): Promise<Response> {
    const dev = process.env.ALINEA_DEV_SERVER
    const local = await db
    const simulateLatency = process.env.ALINEA_LATENCY

    if (simulateLatency) await new Promise(resolve => setTimeout(resolve, 2000))

    async function periodicSync(cnx: RemoteConnection, syncInterval?: number) {
      if (dev) return
      return throttle(() => local.syncWith(cnx), syncInterval)
    }

    try {
      const previews = new JWTPreviews(
        context.apiKey || context.internalToken || 'dev'
      )
      const url = new URL(request.url)
      const params = url.searchParams
      const auth = params.get('auth')
      let cnx = remote(context)
      let userCtx: AuthedContext | undefined
      let internalRequest = false

      if (auth) {
        return cnx.authenticate(request, {
          enrichUser(user) {
            return cnx.enrichUser(user)
          }
        })
      }

      const action = params.get('action') as HandleAction
      const expectJson = () => {
        const acceptsJson = request.headers
          .get('accept')
          ?.includes('application/json')
        if (!acceptsJson) throw new Response('Expected JSON', {status: 400})
      }

      if (action === HandleAction.Capabilities && request.method === 'GET') {
        expectJson()
        const capabilities = cnx.capabilities
        return Response.json(
          capabilities
            ? await capabilities()
            : {users: typeof cnx.listUsers === 'function'}
        )
      }

      if (action === HandleAction.Upload && request.method === 'GET') {
        const entryId = url.searchParams.get('entryId')
        if (entryId && cnx.previewUpload)
          return await cnx.previewUpload(entryId)
      }

      const authorization = request.headers.get('authorization')
      const bearer = authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : undefined
      if (context.internalToken && bearer === context.internalToken) {
        internalRequest = true
      } else {
        try {
          userCtx = await cnx.verify(request)
          cnx = remote(userCtx)
          userCtx = {
            ...userCtx,
            user: await cnx.enrichUser(userCtx.user)
          }
        } catch (cause) {
          if (cause instanceof MissingCredentialsError && bearer)
            throw new InvalidCredentialsError('Invalid internal token', {
              cause
            })
          throw cause
        }
      }

      // User
      if (
        action === HandleAction.User &&
        request.method === 'GET' &&
        !params.has('operation')
      ) {
        expectJson()
        return Response.json(userCtx ? userCtx.user : null)
      }

      const expectUser = () => {
        if (!userCtx) throw new Response('Unauthorized', {status: 401})
        const claims = userCtx.user
        return {
          claims,
          policy: PLazy.from(async () => {
            const roles = claims.roles
            return !roles ? Policy.ALLOW_NONE : local.createPolicy(roles)
          })
        }
      }
      const expectInternal = () => {
        if (!internalRequest) throw new Response('Unauthorized', {status: 401})
      }

      const body = PLazy.from(() => {
        const isJson = request.headers
          .get('content-type')
          ?.includes('application/json')
        if (!isJson) throw new Response('Expected JSON', {status: 400})
        return request.json()
      })

      const contentState = async () => {
        const user = expectUser()
        await local.syncWith(cnx)
        if (!configId) throw new Error('Missing Alinea config release id')
        const roles = user.claims.roles ?? []
        const key = JSON.stringify([user.claims.sub, roles])
        const cached = contentStates.get(key)
        if (cached?.sourceSha === local.sha) return cached.result
        const policy = await user.policy
        const result = await createContentState(local, policy, configId)
        contentStates.set(key, {sourceSha: local.sha, result})
        return result
      }

      if (action === HandleAction.Bootstrap && request.method === 'GET') {
        const user = expectUser()
        expectJson()
        if (!configId || !adminPath)
          throw new Error('Missing Alinea dashboard release settings')
        const normalized = adminPath.startsWith('/')
          ? adminPath
          : `/${adminPath}`
        const base = `${normalized}/release/${configId}`
        const cacheKey = await hashBlob(
          new TextEncoder().encode(`${configId}:${user.claims.sub}`)
        )
        return Response.json(
          {
            configId,
            moduleUrl: `${base}/config.js`,
            styleUrl: `${base}/config.css`,
            cacheKey
          },
          {headers: {'Cache-Control': 'private, no-store'}}
        )
      }

      if (action === HandleAction.ContentState && request.method === 'GET') {
        expectJson()
        const {state} = await contentState()
        if (request.headers.get('if-none-match') === `"${state.revision}"`)
          return new Response(null, {
            status: 304,
            headers: {
              'Cache-Control': 'private, no-store',
              ETag: `"${state.revision}"`
            }
          })
        return Response.json(state, {
          headers: {
            'Cache-Control': 'private, no-store',
            ETag: `"${state.revision}"`
          }
        })
      }

      if (action === HandleAction.ContentEntries && request.method === 'POST') {
        expectJson()
        const {hashes} = object({hashes: array(string)})(await body)
        if (hashes.length > 500)
          throw new HttpError(
            ErrorCode.BadRequest,
            'Too many content objects requested'
          )
        const {state, objects} = await contentState()
        const allowed = new Set(Object.values(state.entries))
        const result = [...new Set(hashes)].map(hash => {
          if (!allowed.has(hash))
            throw new HttpError(ErrorCode.Unauthorized, 'Unknown content hash')
          const object = objects[hash]
          if (!object) throw new HttpError(404, 'Missing content entry')
          return [hash, object] as const
        })
        return Response.json(Object.fromEntries(result), {
          headers: {'Cache-Control': 'private, no-store'}
        })
      }

      if (action === HandleAction.User) {
        const user = expectUser()
        expectJson()
        const policy = await user.policy
        policy.assert(Permission.ManageMembers)
        const operation = params.get('operation')
        if (request.method === 'GET' && operation === 'list') {
          return Response.json(await cnx.listUsers())
        }
        if (request.method === 'POST') {
          const requestUser = parseUser(await body)
          switch (operation) {
            case 'enrich':
              return Response.json(
                await cnx.enrichUser(requireSub(requestUser))
              )
            case 'create':
              return Response.json(await cnx.createUser(requestUser))
            case 'update':
              return Response.json(await cnx.updateUser(requestUser))
            case 'remove':
              await cnx.removeUser(requireEmail(requestUser))
              return new Response(null, {status: 204})
            default:
              throw new HttpError(400, 'Unknown operation')
          }
        }
      }

      // Sign preview token
      if (action === HandleAction.PreviewToken && request.method === 'POST') {
        expectUser()
        expectJson()
        return Response.json(await previews.sign())
      }

      // Resolve
      if (action === HandleAction.Resolve && request.method === 'POST') {
        expectInternal()
        expectJson()
        const raw = await request.text()
        const scope = getScope(cms.config)
        const query = scope.parse<GraphQuery>(raw)
        if (!query.preview) {
          await periodicSync(cnx, query.syncInterval)
        } else {
          const {parse} = await previewParser
          const preview = await parse(query.preview, () => local.syncWith(cnx))
          query.preview = preview
        }
        return Response.json((await local.resolve(query)) ?? null)
      }

      if (action === HandleAction.Mutate && request.method === 'POST') {
        const user = expectUser()
        expectJson()
        const policy = await user.policy
        const mutations = await body
        const attempt = async (retry = 0) => {
          await local.syncWith(cnx)
          const request = {
            ...(await local.request(mutations, policy)),
            user: user.claims
          }
          try {
            let {sha} = await cnx.write(request)
            if (sha === request.intoSha) {
              await local.write(request)
            } else {
              sha = await local.syncWith(cnx)
            }
            return sha
          } catch (error) {
            if (error instanceof ShaMismatchError && retry < 3)
              return attempt(retry + 1)
            throw error
          }
        }
        return Response.json({sha: await attempt()})
      }

      if (action === HandleAction.Commit && request.method === 'POST') {
        throw new Error('Mutations expected')
      }

      // History
      if (action === HandleAction.History && request.method === 'GET') {
        expectUser()
        expectJson()
        const file = string(url.searchParams.get('file'))
        const revisionId = string.nullable(url.searchParams.get('revisionId'))
        const result = await (revisionId
          ? cnx.revisionData(file, revisionId)
          : cnx.revisions(file))
        return Response.json(result ?? null)
      }

      // Syncable

      if (action === HandleAction.Tree && request.method === 'GET') {
        expectInternal()
        expectJson()
        const sha = string(url.searchParams.get('sha'))
        await local.syncWith(cnx)
        const tree = await local.getTreeIfDifferent(sha)
        return Response.json(tree ?? null)
      }

      if (action === HandleAction.Blob && request.method === 'POST') {
        expectInternal()
        const {shas} = object({shas: array(string)})(await body)
        await periodicSync(cnx)
        const tree = await local.source.getTree()
        const fromLocal = []
        const fromRemote = []
        for (const sha of shas) {
          if (tree.hasSha(sha)) fromLocal.push(sha)
          else fromRemote.push(sha)
        }
        const formData = new FormData()
        if (fromLocal.length > 0) {
          const blobs = local.source.getBlobs(fromLocal)
          for await (const [sha, blob] of blobs) {
            formData.append(sha, new Blob([blob as BlobPart]))
          }
        }
        if (fromRemote.length > 0) {
          const blobs = cnx.getBlobs(fromRemote)
          for await (const [sha, blob] of blobs) {
            formData.append(sha, new Blob([blob as BlobPart]))
          }
        }
        return new Response(formData)
      }

      // Media
      if (action === HandleAction.Upload) {
        const user = expectUser()
        const policy = await user.policy
        policy.assert(Permission.Upload)
        const entryId = url.searchParams.get('entryId')
        if (!entryId) {
          expectJson()
          const prepare = PrepareBody(await body)
          if (
            prepare.size !== undefined &&
            (!Number.isSafeInteger(prepare.size) || prepare.size < 0)
          ) {
            throw new HttpError(ErrorCode.BadRequest, 'Invalid upload size')
          }
          assertUploadSize(
            prepare.filename,
            prepare.size,
            cms.config.maxUploadSize
          )
          return Response.json(
            await cnx.prepareUpload(
              prepare.filename,
              prepare.size === undefined
                ? undefined
                : {
                    size: prepare.size
                  }
            )
          )
        }
        const isPost = request.method === 'POST'
        if (isPost && cnx.handleUpload) {
          const contentLength = request.headers.get('content-length')
          assertUploadSize(
            entryId,
            contentLength ? Number(contentLength) : undefined,
            cms.config.maxUploadSize
          )
          const file = await request.blob()
          assertUploadSize(entryId, file.size, cms.config.maxUploadSize)
          await cnx.handleUpload(entryId, file)
          return new Response('OK', {status: 200})
        }
      }

      // Drafts
      if (action === HandleAction.Draft && request.method === 'GET') {
        expectJson()
        const key = string(url.searchParams.get('key')) as DraftKey
        const draft = await cnx.getDraft(key)
        return Response.json(
          draft ? {...draft, draft: base64.stringify(draft.draft)} : null
        )
      }

      if (action === HandleAction.Draft && request.method === 'POST') {
        expectUser()
        expectJson()
        const data = (await body) as DraftTransport
        const draft = {...data, draft: base64.parse(data.draft)}
        return Response.json(await cnx.storeDraft(draft))
      }

      return new Response('Bad Request', {status: 400})
    } catch (error) {
      if (error instanceof Response) return error
      const status = error instanceof HttpError ? error.code : 500
      if (!(error instanceof HttpError)) console.error(error)
      return Response.json(
        {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        },
        {status}
      )
    }
  }
}

function parseUser(input: unknown): UserInput {
  if (!isRecord(input)) throw new HttpError(400, 'Expected user object')
  const {sub, name, email, roles} = input
  if (sub !== undefined && typeof sub !== 'string') {
    throw new HttpError(400, 'Expected user sub')
  }
  if (name !== undefined && typeof name !== 'string') {
    throw new HttpError(400, 'Expected user name')
  }
  if (email !== undefined && typeof email !== 'string') {
    throw new HttpError(400, 'Expected user email')
  }
  if (
    roles !== undefined &&
    (!Array.isArray(roles) || roles.some(role => typeof role !== 'string'))
  ) {
    throw new HttpError(400, 'Expected user roles')
  }
  return {sub, name, email, roles}
}

function requireEmail(user: UserInput): string {
  if (typeof user.email !== 'string') {
    throw new HttpError(400, 'Expected user email')
  }
  return user.email
}

function requireSub(user: UserInput): User {
  if (typeof user.sub !== 'string') {
    throw new HttpError(400, 'Expected user sub')
  }
  return {...user, sub: user.sub}
}
