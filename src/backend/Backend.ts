import {Request, Response} from '@alinea/iso'
import {Connection} from 'alinea/core/Connection'
import {Draft, DraftKey} from 'alinea/core/Draft'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Mutation} from 'alinea/core/Mutation'
import {User} from 'alinea/core/User'

export interface RequestContext {
  handlerUrl: URL
  apiKey: string
}

export interface AuthedContext extends RequestContext {
  user: User
  token: string
}

export interface Target {
  mutate(
    ctx: AuthedContext,
    params: Connection.MutateParams
  ): Promise<{commitHash: string}>
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

export interface Pending {
  since(
    ctx: RequestContext,
    commitHash: string
  ): Promise<{toCommitHash: string; mutations: Array<Mutation>} | undefined>
}

export interface Backend {
  auth: Auth
  target: Target
  media: Media
  drafts: Drafts
  history: History
  pending?: Pending
}
