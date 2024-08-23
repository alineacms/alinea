import {Connection} from 'alinea/core/Connection'
import {Draft} from 'alinea/core/Draft'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Mutation} from 'alinea/core/Mutation'
import {User} from 'alinea/core/User'

export interface RequestContext {
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
  upload(ctx: AuthedContext, file: string): Promise<Connection.UploadResponse>
}

export interface DraftTransport {
  entryId: string
  commitHash: string
  fileHash: string
  draft: string
}

export interface Drafts {
  get(ctx: RequestContext, entryId: string): Promise<Draft | undefined>
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
  revision(ctx: AuthedContext, file: string, ref: string): Promise<EntryRecord>
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
