import {JWTPreviews} from '#/backend/util/JWTPreviews.js'
import {CloudRemote} from '#/cloud/CloudRemote.js'
import {
  BLOB_SEQUENCE_CONTENT_TYPE,
  encodeBlobSequence
} from '#/core/BlobTransport.js'
import type {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import type {
  AuthedContext,
  DraftTransport,
  RemoteConnection,
  RequestContext
} from '#/core/Connection.js'
import {developmentKeyHeader} from '#/core/Connection.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import {loggedSync} from '#/core/db/SyncStats.js'
import type {DashboardEntry} from '#/core/DashboardEntry.js'
import {
  committedEntries,
  type RemovedEntry,
  removedEntries
} from './CommitEntries.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {DraftKey} from '#/core/Draft.js'
import type {EntryRecord} from '#/core/EntryRecord.js'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {ErrorCode, HttpError} from '#/core/HttpError.js'
import {EntryConflictError} from '#/core/db/EntryConflictError.js'
import {MediaLocation} from '#/core/media/MediaLocation.js'
import {FileData} from '#/core/media/MediaTypes.js'
import {assertUploadSize} from '#/core/media/UploadLimits.js'
import {Permission, Policy, type Resource} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {type RemoteSource, sourceAtTree} from '#/core/source/Source.js'
import type {User, UserInput} from '#/core/User.js'
import {base64} from '#/core/util/Encoding.js'
import {within} from '#/core/util/Async.js'
import {isRecord} from '#/core/util/Objects.js'
import {fileVersions} from '#/core/util/EntryFilenames.js'
import {isAbsolute, normalize, relative} from '#/core/util/Paths.js'
import {array, number, object, optional, string} from 'cito'
import PLazy from 'p-lazy'
import {InvalidCredentialsError, MissingCredentialsError} from './Auth.js'
import {HandleAction} from './HandleAction.js'
import {proxyMediaUrl} from './api/ProxyMedia.js'
import {applyPreview, decodePreviewRequest} from './resolver/ParsePreview.js'
import {compressResponse} from './router/Router.js'
import {createThrottledSync, syncWait} from './util/Syncable.js'

const PrepareBody = object({
  filename: string,
  size: optional(number)
})

export interface Handler {
  (request: Request, context: RequestContext): Promise<Response>
}

export type HookResponse<T = void> = void | T | Promise<void | T>

export interface BeforeCommitContext {
  mutations: ReadonlyArray<Mutation>
  /** The user committing the mutations */
  user: User
}

export interface AfterCommitContext extends BeforeCommitContext {
  sha: string
  /**
   * The entries the mutations changed as they are after the commit: the
   * latest version in each locale
   */
  entries: Array<DashboardEntry>
  /** Entries that no longer exist after the commit, with the url they had */
  removed: Array<RemovedEntry>
}

export interface HandlerHooks {
  beforeCommit?(
    context: BeforeCommitContext
  ): HookResponse<ReadonlyArray<Mutation>>
  afterCommit?(context: AfterCommitContext): HookResponse
}

export interface HandlerOptions extends HandlerHooks {
  cms: CMS
  db: LocalStore | Promise<LocalStore>
  remote?: (context: RequestContext) => RemoteConnection
  /** Log why and how long each sync took, for a deployed handler */
  logSyncs?: boolean
  forwardMutations?(
    request: Request,
    context: AuthedContext
  ): Promise<Response | undefined>
}

export function createHandler({
  cms,
  remote = context => new CloudRemote(context, cms.config),
  db,
  forwardMutations,
  logSyncs = false,
  ...hooks
}: HandlerOptions): Handler {
  const throttle = createThrottledSync()
  return async function handle(
    request: Request,
    context: RequestContext
  ): Promise<Response> {
    const dev = process.env.ALINEA_DEV_SERVER
    const local = await db
    const simulateLatency = process.env.ALINEA_LATENCY

    if (simulateLatency) await new Promise(resolve => setTimeout(resolve, 2000))

    /** Reads keep serving the current content when the remote is unreachable. */
    async function syncForRead(sync: Promise<unknown>): Promise<void> {
      try {
        await within(sync, syncWait)
      } catch (error) {
        console.warn(
          `Alinea could not sync with the remote, serving current content: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }

    /** Log why and how long each sync took, except with files on disk. */
    function sync(remote: RemoteSource, reason: string): Promise<string> {
      if (dev || !logSyncs) return local.syncWith(remote)
      return loggedSync(local, remote, reason)
    }

    async function periodicSync(cnx: RemoteConnection, syncInterval?: number) {
      if (dev) return
      // Waits outside the throttle: reads queued behind a hung sync answer too
      return syncForRead(throttle(() => sync(cnx, 'interval'), syncInterval))
    }

    try {
      const previews = new JWTPreviews(context.apiKey)
      const url = new URL(request.url)
      const params = url.searchParams
      const auth = params.get('auth')
      let cnx = remote(context)
      let userCtx: AuthedContext | undefined
      if (auth) {
        return await cnx.authenticate(request, {
          async authenticated(user) {
            try {
              return {
                user: await cnx.enrichUser(user),
                capabilities: await cnx.capabilities()
              }
            } catch (cause) {
              if (cause instanceof HttpError) throw cause
              throw new HttpError(500, 'Failed to complete authentication', {
                cause
              })
            }
          }
        })
      }

      if (
        !params.has('action') &&
        params.has('file') &&
        (request.method === 'GET' || request.method === 'HEAD')
      ) {
        const file = string(params.get('file'))
        const proxy = params.get('delivery') === 'proxy'
        const normalized = normalize(file)
        if (
          isAbsolute(normalized) ||
          normalized === '..' ||
          normalized.startsWith('../')
        )
          throw new HttpError(400, 'Invalid file path')
        await periodicSync(cnx)
        const requestedUrl = Config.filePathname(cms.config, normalized)
        const select = {
          url: Entry.url,
          filePath: Entry.filePath,
          workspace: Entry.workspace,
          location: FileData.location,
          previewUrl: FileData.previewUrl
        }
        const query = {
          type: Config.fileTypes(cms.config),
          status: 'published' as const,
          main: true,
          select
        }
        const entry =
          (await local.first({...query, url: requestedUrl})) ??
          (await local.first({...query, alias: requestedUrl}))
        if (!entry) return new Response('Not found', {status: 404})
        if (entry.url !== requestedUrl && !proxy)
          return new Response(null, {
            status: 308,
            headers: {location: entry.url}
          })
        const wasBuilt = await local.includedAtBuild(entry.filePath)
        const previewUrl = entry.previewUrl
        const location = entry.location
        if (typeof location !== 'string')
          return new Response('Not found', {status: 404})
        const previewSource =
          typeof previewUrl === 'string' && previewUrl
            ? new URL(previewUrl, request.url).href
            : undefined
        async function proxyMedia(source: string, cacheControl: string) {
          const previewEntryId = uploadPreviewEntryId(
            source,
            context.handlerUrl
          )
          let response: Response
          if (previewEntryId && cnx.previewUpload) {
            response = await cnx.previewUpload(previewEntryId)
          } else {
            response = await proxyMediaUrl(
              request,
              new URL(source, request.url)
            )
          }
          return mediaResponse(request, response, cacheControl)
        }
        // In development every media file is on disk
        if (!context.isDev && !wasBuilt && previewSource) {
          if (proxy) return proxyMedia(previewSource, 'private, no-store')
          return redirectFile(previewSource, 'private, no-store')
        }
        const source = MediaLocation.sourceUrl(
          cms.config,
          entry.workspace,
          location
        )
        if (!source || source === requestedUrl)
          return new Response('Not found', {status: 404})
        if (!proxy) return redirectFile(source, 'public, max-age=60')
        // The dev server serves the public dir itself, a deployment serves
        // the files of its own build on the origin that reached it
        const deliveryBase =
          context.publicUrl ??
          (context.isDev ? context.handlerUrl : new URL(request.url))
        return proxyMedia(
          new URL(source, deliveryBase).href,
          'public, max-age=60'
        )
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
        return Response.json(await cnx.capabilities())
      }

      if (action === HandleAction.Upload && request.method === 'GET') {
        const entryId = url.searchParams.get('entryId')
        if (entryId && cnx.previewUpload)
          return await cnx.previewUpload(entryId)
      }

      try {
        userCtx = await cnx.verify(request)
        cnx = remote(userCtx)
        userCtx = {
          ...userCtx,
          user: await cnx.enrichUser(userCtx.user)
        }
      } catch (cause) {
        if (cause instanceof MissingCredentialsError) {
          const credential = context.isDev
            ? request.headers.get(developmentKeyHeader)
            : request.headers.get('authorization')?.slice('Bearer '.length)
          if (!context.apiKey)
            throw new MissingCredentialsError('Missing API key', {cause})
          if (credential !== context.apiKey)
            throw new InvalidCredentialsError('Expected matching api key', {
              cause
            })
        } else {
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

      const body = PLazy.from(() => {
        const isJson = request.headers
          .get('content-type')
          ?.includes('application/json')
        if (!isJson) throw new Response('Expected JSON', {status: 400})
        return request.json()
      })

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
        expectJson()
        const raw = await request.text()
        const scope = getScope(cms.config)
        const query = scope.parse<GraphQuery>(raw)
        if (!query.preview) {
          await periodicSync(
            cnx,
            query.disableSync
              ? Number.POSITIVE_INFINITY
              : (query.syncInterval ?? cms.config.syncInterval)
          )
        } else {
          const preview = await decodePreviewRequest(query.preview)
          if (
            'contentHash' in preview &&
            (await local.sha) !== preview.contentHash
          )
            await syncForRead(
              sync(cnx, `preview at ${preview.contentHash.slice(0, 7)}`)
            )
          query.preview = await applyPreview(local, preview)
        }
        return Response.json((await local.resolve(query)) ?? null)
      }

      if (action === HandleAction.Mutate && request.method === 'POST') {
        if (forwardMutations && userCtx) {
          const forwarded = await forwardMutations(request.clone(), userCtx)
          if (forwarded) return forwarded
        }
        const user = expectUser()
        expectJson()
        const policy = await user.policy
        let mutations = (await body) as ReadonlyArray<Mutation>
        await sync(cnx, 'commit')
        const adjusted = await hooks.beforeCommit?.({
          mutations,
          user: user.claims
        })
        if (adjusted) mutations = adjusted
        const before = hooks.afterCommit
          ? await committedEntries(local, mutations)
          : []
        const attempt = async (retry = 0): Promise<string> => {
          if (retry > 0) await sync(cnx, 'commit retry')
          const request = {
            ...(await local.request(mutations, policy)),
            user: user.claims
          }
          let sha: string
          try {
            sha = (await cnx.write(request)).sha
          } catch (error) {
            const isConflict =
              error instanceof ShaMismatchError ||
              (error instanceof HttpError && error.code === 409) ||
              (error instanceof Response && error.status === 409)
            if (isConflict && retry < 3) return attempt(retry + 1)
            throw error
          }
          // The commit landed: failing to apply it here must not commit it
          // again, eg. when a read synced a later commit in meanwhile. Catch
          // up with the remote instead, or with its next sync.
          try {
            if (sha === request.intoSha) await local.write(request)
            else sha = await sync(cnx, 'after commit')
          } catch {
            sha = await sync(cnx, 'after commit').catch(() => sha)
          }
          return sha
        }
        const sha = await attempt()
        try {
          if (hooks.afterCommit) {
            const entries = await committedEntries(local, mutations)
            await hooks.afterCommit({
              mutations,
              sha,
              user: user.claims,
              entries,
              removed: removedEntries(before, entries)
            })
          }
        } catch (error) {
          console.error('Alinea afterCommit hook failed', error)
        }
        return Response.json({sha})
      }

      // History
      if (action === HandleAction.History && request.method === 'GET') {
        const user = expectUser()
        expectJson()
        const file = string(url.searchParams.get('file'))
        const revisionId = string.nullable(url.searchParams.get('revisionId'))
        const record = revisionId
          ? await cnx.revisionData(file, revisionId)
          : undefined
        // The remote answers for any file: serve the history of an entry only
        // to users who can read it
        const contentDir = Config.contentDir(cms.config)
        const owners = () => historyEntries(local, contentDir, file, record)
        let entries = await owners()
        // Another instance may have created the entry since this one synced
        if (entries.length === 0) {
          await syncForRead(sync(cnx, 'history of an unknown entry'))
          entries = await owners()
        }
        if (entries.length === 0)
          throw new HttpError(ErrorCode.NotFound, 'Entry not found')
        const policy = await user.policy
        for (const entry of entries) policy.assert(Permission.Read, entry)
        const result = revisionId ? record : await cnx.revisions(file)
        return Response.json(result ?? null)
      }

      // Syncable

      if (action === HandleAction.Tree && request.method === 'GET') {
        expectJson()
        const sha = string(url.searchParams.get('sha'))
        // The remote tells whether the client is current in one request, where
        // syncing an instance behind it first downloads every change
        let source: RemoteSource = cnx
        const start = performance.now()
        try {
          const remoteTree = await cnx.getTreeIfDifferent(sha)
          if (!remoteTree) return Response.json(null)
          source = sourceAtTree(cnx, remoteTree)
        } catch {
          // The sync below warns about an unreachable remote and serves the
          // current content
        }
        // The sync starts from the remote tree fetched above, log its wait
        const remoteMs = Math.round(performance.now() - start)
        const reason = `tree from ${sha.slice(0, 7)}, remote tree ${remoteMs} ms`
        await syncForRead(sync(source, reason))
        const tree = await local.getTreeIfDifferent(sha)
        return compressResponse(request, Response.json(tree ?? null))
      }

      if (action === HandleAction.Sha && request.method === 'GET') {
        expectJson()
        await syncForRead(sync(cnx, 'sha'))
        return Response.json(await local.sha)
      }

      if (action === HandleAction.Blob && request.method === 'POST') {
        const {shas} = object({shas: array(string)})(await body)
        // Clients ask for blobs of a tree an instance answered with: one that
        // has not synced to it yet does so now and keeps them, so the remote
        // is asked for each change once instead of for every client.
        let tree = await local.source.getTree()
        if (!dev && shas.some(sha => !tree.hasSha(sha))) {
          await syncForRead(sync(cnx, 'blobs of a newer tree'))
          tree = await local.source.getTree()
        }
        const fromLocal: Array<string> = []
        const fromRemote: Array<string> = []
        for (const sha of shas) {
          if (tree.hasSha(sha)) fromLocal.push(sha)
          else fromRemote.push(sha)
        }
        async function* blobs() {
          const options = {signal: request.signal}
          if (fromLocal.length > 0)
            yield* local.source.getBlobs(fromLocal, options)
          if (fromRemote.length > 0) yield* cnx.getBlobs(fromRemote, options)
        }
        return compressResponse(
          request,
          new Response(encodeBlobSequence(blobs()), {
            headers: {'content-type': BLOB_SEQUENCE_CONTENT_TYPE}
          })
        )
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
          error: error instanceof Error ? error.message : String(error),
          conflict: error instanceof EntryConflictError ? error.info : undefined
        },
        {status}
      )
    }
  }
}

const historyResource = {
  id: Entry.id,
  type: Entry.type,
  workspace: Entry.workspace,
  root: Entry.root,
  parents: Entry.parents,
  locale: Entry.locale
}

/** The entries, in every status, whose history a file holds. */
async function historyEntries(
  local: LocalStore,
  contentDir: string,
  file: string,
  record?: EntryRecord
): Promise<Array<Resource>> {
  const filePath = relative(contentDir, file)
  if (filePath.startsWith('../')) return []
  const status = 'all'
  const select = historyResource
  const atFile = await local.find({
    filePath: {in: fileVersions(filePath)},
    status,
    select
  })
  const id = record?._id
  if (atFile.length > 0 || typeof id !== 'string') return atFile
  // A revision can hold the entry under a name it had before
  return local.find({id, status, select})
}

function redirectFile(location: string, cacheControl: string): Response {
  return new Response(null, {
    status: 307,
    headers: {'cache-control': cacheControl, location}
  })
}

function uploadPreviewEntryId(
  previewSource: string,
  handlerUrl: URL
): string | undefined {
  const previewUrl = new URL(previewSource)
  if (
    previewUrl.origin !== handlerUrl.origin ||
    previewUrl.pathname !== handlerUrl.pathname ||
    previewUrl.searchParams.get('action') !== HandleAction.Upload
  )
    return
  return previewUrl.searchParams.get('entryId') ?? undefined
}

function mediaResponse(
  request: Request,
  upstream: Response,
  cacheControl: string
): Response {
  const responseHeaders = new Headers({
    'cache-control':
      upstream.ok || upstream.status === 304 ? cacheControl : 'no-store'
  })
  for (const name of [
    'accept-ranges',
    'content-disposition',
    'content-length',
    'content-range',
    'content-type',
    'etag',
    'last-modified'
  ]) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }
  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  })
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
