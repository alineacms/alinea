import {JWTPreviews} from '#/backend/util/JWTPreviews.js'
import {CloudRemote} from '#/cloud/CloudRemote.js'
import {Entry} from '#/core.js'
import type {CMS} from '#/core/CMS.js'
import type {
  AuthedContext,
  DraftTransport,
  RemoteConnection,
  RequestContext
} from '#/core/Connection.js'
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
import {createPreviewParser} from './resolver/ParsePreview.js'
import {createThrottledSync} from './util/Syncable.js'
import {diffDatabaseSnapshots} from '#/database/Database.js'
import {buildEntryDatabase} from '#/database/entry/Source.js'
import {prepareFieldMutation} from '#/database/handler/Mutation.js'
import type {ReplicaService} from '#/database/handler/Service.js'
import {exportEntryReleaseDelta} from '#/database/release/Delta.js'
import type {FieldTransaction} from '#/database/replica/Operations.js'
import {serializeReplicaState} from '#/database/replica/Serialization.js'
import {createId} from '#/core/Id.js'
import {DatabaseResolver} from '#/database/query/Resolver.js'
import {entryResource} from '#/database/entry/Access.js'
import {isEntryCoreRecord} from '#/database/entry/Model.js'
import {
  mutationsFromReplicaCommands,
  parseReplicaCommands
} from '#/database/replica/Commands.js'
import {requestSourceMutations} from '#/database/handler/SourceWriter.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import type {Mutation} from '#/core/db/Mutation.js'

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
  db: SourceDB | Promise<SourceDB>
  remote?: (context: RequestContext) => RemoteConnection
  replica?: ReplicaService | Promise<ReplicaService>
}

export function createHandler({
  cms,
  remote = context => new CloudRemote(context, cms.config),
  db,
  replica,
  ...hooks
}: HandlerOptions): Handler {
  const throttle = createThrottledSync()
  const replicaWrite = pLimit(1)
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
      const previews = new JWTPreviews(context.apiKey)
      const url = new URL(request.url)
      const params = url.searchParams
      const auth = params.get('auth')
      let cnx = remote(context)
      let userCtx: AuthedContext | undefined

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
          const authorization = request.headers.get('authorization')
          const bearer = authorization?.slice('Bearer '.length)
          if (!context.apiKey)
            throw new MissingCredentialsError('Missing API key', {cause})
          if (bearer !== context.apiKey)
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

      const expectReplica = async () => {
        if (!replica) throw new HttpError(404, 'Replica is not configured')
        const user = expectUser()
        const roles = user.claims.roles ?? []
        const service = await replica
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
        const {service, session} = await expectReplica()
        const state = service.state(
          session,
          url.searchParams.get('revision') ?? undefined
        )
        return state
          ? Response.json(serializeReplicaState(state))
          : new Response(null, {status: 204})
      }

      if (action === HandleAction.ReplicaObject && request.method === 'GET') {
        expectJson()
        const {service, session} = await expectReplica()
        const id = string(url.searchParams.get('id'))
        const record = service.object(session, id)
        return record
          ? Response.json(record)
          : new Response(null, {status: 404})
      }

      if (
        action === HandleAction.ReplicaEligible &&
        request.method === 'POST'
      ) {
        expectJson()
        const {service, session} = await expectReplica()
        const scope = getScope(cms.config)
        const query = scope.parse<GraphQuery>(await request.text())
        const eligibilityQuery = {
          ...query,
          first: undefined,
          get: undefined,
          count: undefined,
          select: Entry.id
        } as GraphQuery
        const ids = await new DatabaseResolver(
          cms.config,
          service.release.snapshot
        ).resolve(eligibilityQuery)
        const candidates = new Set(ids as Array<string>)
        const visible = new Set<string>()
        for (const record of service.release.snapshot.records()) {
          if (!isEntryCoreRecord(record) || !candidates.has(record.entryId))
            continue
          const resource = entryResource(record)
          if (
            session.policy.canRead(resource) ||
            session.policy.canExplore(resource)
          )
            visible.add(record.entryId)
        }
        return Response.json([...visible])
      }

      if (action === HandleAction.ReplicaMutate && request.method === 'POST') {
        expectJson()
        const {service, session} = await expectReplica()
        const transaction = parseFieldTransaction(await body)
        return Response.json(
          await service.mutateWith(session, transaction, async () => {
            return replicaWrite(async () => {
              await syncWith(local.source, cnx)
              await updateReplicaFromSource(
                service,
                cms.config,
                local.source,
                context
              )
              const prepared = await prepareFieldMutation(
                service.release.snapshot,
                transaction,
                session.policy
              )
              if (prepared.mutations.length === 0)
                return {
                  revision: service.release.snapshot.revision,
                  conflicts: prepared.conflicts
                }
              await writeSourceMutations(
                cms.config,
                local.source,
                cnx,
                [...prepared.mutations],
                session.policy,
                userCtx!.user
              )
              await updateReplicaFromSource(
                service,
                cms.config,
                local.source,
                context
              )
              return {
                revision: service.release.snapshot.revision,
                conflicts: prepared.conflicts
              }
            })
          })
        )
      }

      if (action === HandleAction.ReplicaCommand && request.method === 'POST') {
        expectJson()
        const {service, session} = await expectReplica()
        const commands = parseReplicaCommands(await body)
        return replicaWrite(async () => {
          const mutations = mutationsFromReplicaCommands(commands)
          await syncWith(local.source, cnx)
          await writeSourceMutations(
            cms.config,
            local.source,
            cnx,
            mutations,
            session.policy,
            userCtx!.user
          )
          await updateReplicaFromSource(
            service,
            cms.config,
            local.source,
            context
          )
          return Response.json({revision: service.release.snapshot.revision})
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
        const sha = await attempt()
        if (replica) {
          const service = await replica
          await updateReplicaFromSource(
            service,
            cms.config,
            local.source,
            context
          )
        }
        return Response.json({sha})
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
        expectJson()
        const sha = string(url.searchParams.get('sha'))
        await local.syncWith(cnx)
        const tree = await local.getTreeIfDifferent(sha)
        return Response.json(tree ?? null)
      }

      if (action === HandleAction.Blob && request.method === 'POST') {
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

async function writeSourceMutations(
  config: import('#/core/Config.js').Config,
  source: import('#/core/source/Source.js').Source,
  remote: RemoteConnection,
  mutations: Array<Mutation>,
  policy: Policy,
  user: User
): Promise<string> {
  const request = {
    ...(await requestSourceMutations(config, source, mutations, policy)),
    user
  }
  let {sha} = await remote.write(request)
  if (sha === request.intoSha) await source.applyChanges(sourceChanges(request))
  else {
    await syncWith(source, remote)
    sha = (await source.getTree()).sha
  }
  return sha
}

async function updateReplicaFromSource(
  service: ReplicaService,
  config: import('#/core/Config.js').Config,
  source: import('#/core/source/Source.js').Source,
  context: RequestContext
): Promise<void> {
  const previous = service.release
  const snapshot = await buildEntryDatabase(config, source)
  if (snapshot.revision === previous.snapshot.revision) return
  const commit = diffDatabaseSnapshots(previous.snapshot, snapshot)
  const bundleId = createId()
  const bundleUrl = new URL(context.handlerUrl)
  bundleUrl.searchParams.set('action', HandleAction.ReplicaBundle)
  bundleUrl.searchParams.set('bundle', bundleId)
  const delta = await exportEntryReleaseDelta({
    bundleId,
    bundleUrl: String(bundleUrl),
    snapshot: commit.snapshot,
    changes: commit.changes,
    previousCatalog: previous.catalog,
    previousKeys: previous.keys
  })
  service.installOverlay(
    {snapshot: commit.snapshot, catalog: delta.catalog, keys: delta.keys},
    bundleId,
    delta.overlay.contents
  )
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
