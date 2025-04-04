import type {PreviewInfo} from 'alinea/backend/Previews'
import type {Draft, DraftKey} from './Draft.js'
import type {EntryRecord} from './EntryRecord.js'
import type {AnyQueryResult, GraphQuery} from './Graph.js'
import type {User} from './User.js'
import type {CommitRequest} from './db/CommitRequest.js'
import type {Mutation} from './db/Mutation.js'
import type {ReadonlyTree} from './source/Tree.js'

export interface AuthApi {
  authenticate(request: Request, ctx: RequestContext): Promise<Response>
  verify(request: Request, ctx: RequestContext): Promise<AuthedContext>
}

export interface RemoteConnection extends Connection, AuthApi {}

export interface LocalConnection extends Connection {
  mutate(
    mutations: Array<Mutation>,
    ctx?: RequestContext
  ): Promise<{sha: string}>
  previewToken(request: PreviewInfo, ctx?: RequestContext): Promise<string>
  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>>
  user(): Promise<User | undefined>
}

export interface SyncApi {
  getTreeIfDifferent(
    sha: string,
    ctx?: RequestContext
  ): Promise<ReadonlyTree | undefined>
  getBlobs(
    shas: Array<string>,
    ctx?: RequestContext
  ): Promise<Array<[sha: string, blob: Uint8Array]>>
}

export interface CommitApi {
  commit(request: CommitRequest, ctx?: RequestContext): Promise<{sha: string}>
}

export interface HistoryApi {
  revisions(file: string, ctx?: RequestContext): Promise<Array<Revision>>
  revisionData(
    file: string,
    revisionId: string,
    ctx?: RequestContext
  ): Promise<EntryRecord | undefined>
}

export interface DraftsApi {
  getDraft(draftKey: DraftKey, ctx?: RequestContext): Promise<Draft | undefined>
  storeDraft(draft: Draft, ctx?: RequestContext): Promise<void>
}

export interface UploadsApi {
  prepareUpload(file: string, ctx?: RequestContext): Promise<UploadResponse>
  handleUpload?(entryId: string, file: Blob, ctx?: AuthedContext): Promise<void>
  previewUpload?(entryId: string, ctx?: RequestContext): Promise<Response>
}

export interface Connection
  extends CommitApi,
    SyncApi,
    HistoryApi,
    DraftsApi,
    UploadsApi {}

export interface RequestContext {
  isDev: boolean
  handlerUrl: URL
  apiKey: string
}

export interface AuthedContext extends RequestContext {
  user: User
  token: string
}

export interface Revision {
  ref: string
  createdAt: number
  file: string
  user?: User
  description?: string
}

export interface UploadDestination {
  entryId: string
  location: string
  previewUrl: string
}

export interface UploadResponse extends UploadDestination {
  url: string
  method?: string
}

export interface DraftTransport {
  entryId: string
  locale: string | null
  commitHash: string
  fileHash: string
  draft: string
}
