import {JWTPreviews} from '#/backend/util/JWTPreviews.js'
import {CloudRemote} from '#/cloud/CloudRemote.js'
import {Entry} from '#/core.js'
import {
  BLOB_SEQUENCE_CONTENT_TYPE,
  encodeBlobSequence
} from '#/core/BlobTransport.js'
import type {CMS} from '#/core/CMS.js'
import type {
  AuthedContext,
  DraftTransport,
  RemoteConnection,
  RequestContext
} from '#/core/Connection.js'
import {developmentKeyHeader} from '#/core/Connection.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {SourceDB} from '#/database/entry/SourceDB.js'
import type {DraftKey} from '#/core/Draft.js'
import type {GraphQuery} from '#/core/Graph.js'
import {ErrorCode, HttpError} from '#/core/HttpError.js'
import {assertUploadSize} from '#/core/media/UploadLimits.js'
import {Permission, Policy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {syncWith} from '#/core/source/Source.js'
import type {User, UserInput} from '#/core/User.js'
import {base64} from '#/core/util/Encoding.js'
import {isRecord} from '#/core/util/Objects.js'
import {array, number, object, optional, string} from 'cito'
import PLazy from 'p-lazy'
import pLimit from 'p-limit'
import {InvalidCredentialsError, MissingCredentialsError} from './Auth.js'
import {HandleAction} from './HandleAction.js'
import {applyPreview, decodePreviewRequest} from './resolver/ParsePreview.js'
import {compressResponse} from './router/Router.js'
import {createThrottledSync} from './util/Syncable.js'
import type {
  AuthenticatedReplicaSession,
  ReplicaService
} from '#/database/handler/Service.js'
import type {FieldTransaction} from '#/database/replica/Operations.js'
import {serializeReplicaState} from '#/database/replica/Serialization.js'
import {createId} from '#/core/Id.js'
import {exportRuntimeSourceChanges} from '#/database/runtime/Exporter.js'
import {runtimeDeltaEntryIds} from '#/database/runtime/Snapshot.js'
import {entryResource} from '#/database/entry/Access.js'
import {
  mutationsFromReplicaCommands,
  parseReplicaCommands
} from '#/database/replica/Commands.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import type {ChangesBatch} from '#/core/source/Change.js'

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
}

export interface AfterCommitContext extends BeforeCommitContext {
  sha: string
}

export interface HandlerHooks {
  beforeCommit?(
    context: BeforeCommitContext
  ): HookResponse<ReadonlyArray<Mutation>>
  afterCommit?(context: AfterCommitContext): HookResponse
}

export interface HandlerOptions extends HandlerHooks {
  cms: CMS
  db: SourceDB | Promise<SourceDB>
  remote?: (context: RequestContext) => RemoteConnection
  replica?: ReplicaService | Promise<ReplicaService>
  forwardMutations?(
    request: Request,
    context: AuthedContext
  ): Promise<Response | undefined>
}

function commitUser(
  session: AuthenticatedReplicaSession,
  context?: AuthedContext
): User {
  return (
    context?.user ?? {
      sub: session.user.id,
      roles: [...session.user.roles]
    }
  )
}

export function createHandler({
  cms,
  remote = context => new CloudRemote(context, cms.config),
  db,
  replica,
  forwardMutations,
  ...hooks
}: HandlerOptions): Handler {
  const throttle = createThrottledSync()
  // Source synchronization and commits must observe one continuous tree
  // history. SourceDB has its own lock, but replica synchronization operates
  // directly on the shared Source and therefore belongs in this lock too.
  const sourceWrite = pLimit(1)
  return async function handle(
    request: Request,
    context: RequestContext
  ): Promise<Response> {
    const dev = process.env.ALINEA_DEV_SERVER
    const local = await db
    const simulateLatency = process.env.ALINEA_LATENCY

    if (simulateLatency) await new Promise(resolve => setTimeout(resolve, 2000))

    async function syncLocalUnlocked(cnx: RemoteConnection): Promise<string> {
      if (replica) {
        const changes = await syncWith(local.source, cnx)
        await updateReplicaFromSource(
          await replica,
          cms.config,
          local,
          context,
          changes
        )
        return local.sha
      }
      return local.syncWith(cnx)
    }

    function syncLocal(cnx: RemoteConnection): Promise<string> {
      return sourceWrite(() => syncLocalUnlocked(cnx))
    }

    async function periodicSync(cnx: RemoteConnection, syncInterval?: number) {
      if (dev) return
      return throttle(() => syncLocal(cnx), syncInterval)
    }

    try {
      const previews = new JWTPreviews(context.apiKey)
      const url = new URL(request.url)
      const params = url.searchParams
      const auth = params.get('auth')
      let cnx = remote(context)
      let userCtx: AuthedContext | undefined
      let trustedServer = false
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
          trustedServer = true
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

      const expectReplica = async () => {
        if (!replica) throw new HttpError(404, 'Replica is not configured')
        const service = await replica
        if (trustedServer) {
          const session: AuthenticatedReplicaSession = {
            user: {id: 'server', roles: []},
            policy: Policy.ALLOW_ALL,
            policyFingerprint: 'trusted:server'
          }
          return {service, session}
        }
        const user = expectUser()
        const roles = user.claims.roles ?? []
        return {
          service,
          session: await service.session({id: user.claims.sub, roles})
        }
      }

      if (
        action === HandleAction.ReplicaBootstrap &&
        request.method === 'GET'
      ) {
        expectJson()
        const {service, session} = await expectReplica()
        return Response.json(service.bootstrap(session))
      }

      if (action === HandleAction.ReplicaState && request.method === 'GET') {
        expectJson()
        await periodicSync(cnx, cms.config.syncInterval)
        const {service, session} = await expectReplica()
        const revision = url.searchParams.get('revision')
        const viewId = url.searchParams.get('view')
        const state = service.state(
          session,
          revision && viewId ? {revision, viewId} : undefined
        )
        return state
          ? Response.json(serializeReplicaState(state))
          : new Response(null, {status: 204})
      }

      if (
        action === HandleAction.ReplicaEligible &&
        request.method === 'POST'
      ) {
        expectJson()
        const {service, session} = await expectReplica()
        const scope = getScope(cms.config)
        const query = scope.parse<GraphQuery>(await request.text())
        const {
          first: _first,
          get: _get,
          count: _count,
          skip: _skip,
          take: _take,
          groupBy: _groupBy,
          orderBy: _orderBy,
          select: _select,
          include: _include,
          ...candidateQuery
        } = query
        const eligibilityQuery = {
          ...candidateQuery,
          select: Entry.id
        } as GraphQuery
        const ids = await service.graph().resolve(eligibilityQuery)
        const candidates = new Set(ids as Array<string>)
        const visible = new Set<string>()
        for (const record of service.cores()) {
          if (!record.queryable || !candidates.has(record.entryId)) continue
          const resource = entryResource(record)
          // Payload filters run against the trusted graph. Returning an
          // explore-only id would reveal whether hidden data matched.
          if (session.policy.canRead(resource)) visible.add(record.entryId)
        }
        return Response.json([...visible])
      }

      if (action === HandleAction.ReplicaMutate && request.method === 'POST') {
        if (forwardMutations && userCtx) {
          const forwarded = await forwardMutations(request.clone(), userCtx)
          if (forwarded) return forwarded
        }
        expectJson()
        const {service, session} = await expectReplica()
        const transaction = parseFieldTransaction(await body)
        return Response.json(
          await service.mutateWith(session, transaction, async () => {
            return sourceWrite(async () => {
              await syncLocalUnlocked(cnx)
              const prepared = await service.prepareFieldMutation(
                transaction,
                session.policy
              )
              if (prepared.mutations.length === 0)
                return {
                  revision: service.revision,
                  conflicts: prepared.conflicts
                }
              const sha = await commitMutations(
                prepared.mutations,
                cnx,
                session.policy,
                commitUser(session, userCtx)
              )
              return {
                revision: sha,
                conflicts: prepared.conflicts
              }
            })
          })
        )
      }

      if (action === HandleAction.ReplicaCommand && request.method === 'POST') {
        if (forwardMutations && userCtx) {
          const forwarded = await forwardMutations(request.clone(), userCtx)
          if (forwarded) return forwarded
        }
        expectJson()
        const {service, session} = await expectReplica()
        const commands = parseReplicaCommands(await body)
        return sourceWrite(async () => {
          const mutations = mutationsFromReplicaCommands(commands)
          if (mutations.length === 0)
            return Response.json({revision: service.revision})
          await syncLocalUnlocked(cnx)
          const sha = await commitMutations(
            mutations,
            cnx,
            session.policy,
            commitUser(session, userCtx)
          )
          return Response.json({revision: sha})
        })
      }

      if (action === HandleAction.ReplicaBundle && request.method === 'GET') {
        const {service} = await expectReplica()
        const bundleId = string(url.searchParams.get('bundle'))
        const size = service.bundleSize(bundleId)
        if (size === undefined) throw new HttpError(404, 'Bundle not found')
        const range = parseByteRange(request.headers.get('range'), size)
        const contents = service.bundle(bundleId, range.offset, range.length)
        return new Response(contents as BodyInit, {
          status: range.partial ? 206 : 200,
          headers: {
            'accept-ranges': 'bytes',
            'content-type': 'application/octet-stream',
            'content-length': String(contents.length),
            ...(range.partial
              ? {
                  'content-range': `bytes ${range.offset}-${range.offset + contents.length - 1}/${size}`
                }
              : {})
          }
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
          if ('contentHash' in preview && local.sha !== preview.contentHash)
            await syncLocal(cnx)
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
        const mutations = (await body) as ReadonlyArray<Mutation>
        const sha = await sourceWrite(async () => {
          await syncLocalUnlocked(cnx)
          return commitMutations(mutations, cnx, policy, user.claims)
        })
        return Response.json({sha})
      }

      if (action === HandleAction.Commit && request.method === 'POST') {
        if (!context.isDev)
          throw new HttpError(400, 'Commits are only accepted in development')
        const developmentKey = request.headers.get(developmentKeyHeader)
        if (!context.apiKey || developmentKey !== context.apiKey)
          throw new HttpError(401, 'Invalid development commit credentials')
        const user = expectUser()
        expectJson()
        const commit = {
          ...((await body) as CommitRequest),
          user: user.claims
        }
        const sha = await sourceWrite(async () => {
          const result = await cnx.write(commit)
          if (result.sha === commit.intoSha) await local.write(commit)
          else return syncLocalUnlocked(cnx)
          return result.sha
        })
        return Response.json({sha})
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
        expectJson()
        const sha = string(url.searchParams.get('sha'))
        await syncLocal(cnx)
        const tree = await local.getTreeIfDifferent(sha)
        return compressResponse(request, Response.json(tree ?? null))
      }

      if (action === HandleAction.Blob && request.method === 'POST') {
        const {shas} = object({shas: array(string)})(await body)
        await periodicSync(cnx)
        const tree = await local.source.getTree()
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
          error: error instanceof Error ? error.message : String(error)
        },
        {status}
      )
    }

    /** Commit mutations while sourceWrite is held by the caller. */
    async function commitMutations(
      requested: ReadonlyArray<Mutation>,
      cnx: RemoteConnection,
      policy: Policy,
      user: User
    ): Promise<string> {
      let mutations = requested
      const adjusted = await hooks.beforeCommit?.({mutations})
      if (adjusted) mutations = adjusted

      const attempt = async (retry = 0): Promise<string> => {
        if (retry > 0) await syncLocalUnlocked(cnx)
        const request = {
          ...(await local.request([...mutations], policy)),
          user
        }
        try {
          let {sha} = await cnx.write(request)
          if (sha === request.intoSha) {
            const changes = sourceChanges(request)
            if (replica) {
              await local.source.applyChanges(changes)
              await updateReplicaFromSource(
                await replica,
                cms.config,
                local,
                context,
                changes
              )
            } else {
              await local.write(request)
            }
          } else {
            sha = await syncLocalUnlocked(cnx)
          }
          return sha
        } catch (error) {
          const isConflict =
            error instanceof ShaMismatchError ||
            (error instanceof HttpError && error.code === 409) ||
            (error instanceof Response && error.status === 409)
          if (isConflict && retry < 3) return attempt(retry + 1)
          throw error
        }
      }

      const sha = await attempt()
      try {
        await hooks.afterCommit?.({mutations, sha})
      } catch (error) {
        console.error('Alinea afterCommit hook failed', error)
      }
      return sha
    }
  }
}

async function updateReplicaFromSource(
  service: ReplicaService,
  config: import('#/core/Config.js').Config,
  local: SourceDB,
  context: RequestContext,
  changes: ChangesBatch
): Promise<void> {
  const source = local.source
  if (changes.changes.length === 0) return
  const previous = service.snapshot.index
  const tree = await source.getTree()
  const bundleId = createId()
  const artifact = await exportRuntimeSourceChanges({
    config,
    previous,
    tree,
    changes,
    bundleId,
    bundleUrl: replicaBundleUrl(context, bundleId)
  })
  service.install(artifact)
  local.refreshSnapshot(service.snapshot, runtimeDeltaEntryIds(artifact.delta))
}

function replicaBundleUrl(context: RequestContext, bundleId: string): string {
  const bundleUrl = new URL(context.handlerUrl)
  bundleUrl.searchParams.set('action', HandleAction.ReplicaBundle)
  bundleUrl.searchParams.set('bundle', bundleId)
  return String(bundleUrl)
}

function parseFieldTransaction(input: unknown): FieldTransaction {
  if (
    !isRecord(input) ||
    typeof input.id !== 'string' ||
    typeof input.baseRevision !== 'string' ||
    !Array.isArray(input.operations)
  )
    throw new HttpError(400, 'Expected field transaction')
  return input as unknown as FieldTransaction
}

function parseByteRange(
  header: string | null,
  size: number
): {offset: number; length: number; partial: boolean} {
  if (!header) return {offset: 0, length: size, partial: false}
  const match = /^bytes=(\d+)-(\d+)$/.exec(header)
  if (!match) throw new HttpError(416, 'Invalid byte range')
  const offset = Number(match[1])
  const end = Number(match[2])
  if (offset > end || offset >= size)
    throw new HttpError(416, 'Byte range is outside the bundle')
  return {
    offset,
    length: Math.min(end, size - 1) - offset + 1,
    partial: true
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
