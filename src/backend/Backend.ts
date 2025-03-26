import type {Request, Response} from '@alinea/iso'
import type {Connection} from 'alinea/core/Connection'
import type {Draft, DraftKey} from 'alinea/core/Draft'
import type {EntryRecord} from 'alinea/core/EntryRecord'
import type {User} from 'alinea/core/User'
import type {CommitRequest} from 'alinea/core/db/CommitRequest.js'
import type {ReadonlyTree} from 'alinea/core/source/Tree.js'

export interface RequestContext {
  handlerUrl: URL
  apiKey: string
}

export interface AuthedContext extends RequestContext {
  user: User
  token: string
}

export interface Target {
  getTreeIfDifferent(
    ctx: RequestContext,
    sha: string
  ): Promise<ReadonlyTree | undefined>
  getBlob(ctx: RequestContext, sha: string): Promise<Uint8Array>
  commit(ctx: RequestContext, request: CommitRequest): Promise<string>
}

export interface Auth {
  authenticate(ctx: RequestContext, request: Request): Promise<Response>
  verify(ctx: RequestContext, request: Request): Promise<AuthedContext>
}

export interface Media {
  prepareUpload(
    ctx: AuthedContext,
    file: string
  ): Promise<Connection.UploadResponse>
  handleUpload?(ctx: AuthedContext, entryId: string, file: Blob): Promise<void>
  previewUpload?(ctx: RequestContext, entryId: string): Promise<Response>
}

export interface DraftTransport {
  entryId: string
  locale: string | null
  commitHash: string
  fileHash: string
  draft: string
}

export interface Drafts {
  get(ctx: RequestContext, draftKey: DraftKey): Promise<Draft | undefined>
  store(ctx: AuthedContext, draft: Draft): Promise<void>
}

export interface Revision {
  ref: string
  createdAt: number
  file: string
  user?: User
  description?: string
}

export interface History {
  list(ctx: AuthedContext, file: string): Promise<Array<Revision>>
  revision(
    ctx: AuthedContext,
    file: string,
    ref: string
  ): Promise<EntryRecord | undefined>
}

export interface Backend {
  auth: Auth
  target: Target
  media: Media
  drafts: Drafts
  history: History
}
