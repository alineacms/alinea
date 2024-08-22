import {Connection} from 'alinea/core/Connection'
import {Draft} from 'alinea/core/Draft'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Mutation} from 'alinea/core/Mutation'
import {ResolveRequest} from 'alinea/core/Resolver'
import {User} from 'alinea/core/User'
import {Revision} from './History.js'

export interface RequestContext {
  apiKey: string
}

export interface AuthedContext extends RequestContext {
  user: User
  token: string
}

export interface Backend {
  resolve(ctx: RequestContext, params: ResolveRequest): Promise<unknown>
  pendingSince(
    ctx: RequestContext,
    commitHash: string
  ): Promise<{toCommitHash: string; mutations: Array<Mutation>} | undefined>
  getDraft(ctx: RequestContext, entryId: string): Promise<Draft | undefined>
  storeDraft(ctx: RequestContext, draft: Draft): Promise<void>

  auth(ctx: RequestContext, request: Request): Promise<Response>
  verify(ctx: RequestContext, request: Request): Promise<AuthedContext>

  upload(ctx: AuthedContext, file: string): Promise<Connection.UploadResponse>
  mutate(
    ctx: AuthedContext,
    params: Connection.MutateParams
  ): Promise<{commitHash: string}>
  listRevisions(ctx: AuthedContext, file: string): Promise<Array<Revision>>
  getRevision(
    ctx: AuthedContext,
    file: string,
    revisionId: string
  ): Promise<EntryRecord>
}
