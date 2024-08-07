import {Connection} from 'alinea/core/Connection'
import {Draft} from 'alinea/core/Draft'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Mutation} from 'alinea/core/Mutation'
import {Drafts} from './Drafts.js'
import {History, Revision} from './History.js'
import {Media} from './Media.js'
import {Pending} from './Pending.js'
import {Target} from './Target.js'

export interface Backend extends Media, Target, History, Pending, Drafts {
  // Media
  prepareUpload(
    file: string,
    ctx: Connection.Context
  ): Promise<Connection.UploadResponse>
  // Target
  mutate(
    params: Connection.MutateParams,
    ctx: Connection.Context
  ): Promise<{commitHash: string}>
  // History
  revisions(file: string, ctx: Connection.Context): Promise<Array<Revision>>
  revisionData(
    file: string,
    revisionId: string,
    ctx: Connection.Context
  ): Promise<EntryRecord>
  // Pending
  pendingSince(
    commitHash: string,
    ctx: Connection.Context
  ): Promise<{toCommitHash: string; mutations: Array<Mutation>} | undefined>
  // Draft
  getDraft(entryId: string, ctx: Connection.Context): Promise<Draft | undefined>
  storeDraft(draft: Draft, ctx: Connection.Context): Promise<void>
}
