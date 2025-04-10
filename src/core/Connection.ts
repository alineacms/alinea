import type {PreviewInfo} from 'alinea/backend/Previews'
import type {Draft, DraftKey} from './Draft.js'
import type {EntryRecord} from './EntryRecord.js'
import type {AnyQueryResult, GraphQuery} from './Graph.js'
import type {User} from './User.js'
import type {CommitRequest} from './db/CommitRequest.js'
import type {Mutation} from './db/Mutation.js'
import type {ReadonlyTree} from './source/Tree.js'

export interface AuthApi {
  authenticate(request: Request): Promise<Response>
  verify(request: Request): Promise<AuthedContext>
}

export interface RemoteConnection extends Connection, AuthApi {}

export interface LocalConnection extends Connection {
  mutate(mutations: Array<Mutation>): Promise<{sha: string}>
  previewToken(request: PreviewInfo): Promise<string>
  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>>
  user(): Promise<User | undefined>
}

export interface SyncApi {
  getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined>
  getBlobs(shas: Array<string>): Promise<Array<[sha: string, blob: Uint8Array]>>
}

export interface CommitApi {
  write(request: CommitRequest): Promise<{sha: string}>
}

export interface HistoryApi {
  revisions(file: string): Promise<Array<Revision>>
  revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined>
}

export interface DraftsApi {
  getDraft(draftKey: DraftKey): Promise<Draft | undefined>
  storeDraft(draft: Draft): Promise<void>
}

export interface UploadsApi {
  prepareUpload(file: string): Promise<UploadResponse>
  handleUpload?(entryId: string, file: Blob): Promise<void>
  previewUpload?(entryId: string): Promise<Response>
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
  user?: User
  token?: string
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
