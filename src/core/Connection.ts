import {Revision} from 'alinea/backend/Backend'
import {PreviewInfo} from 'alinea/backend/Previews'
import {ChangeSet} from 'alinea/backend/data/ChangeSet'
import {Draft, DraftKey} from './Draft.js'
import {EntryRecord} from './EntryRecord.js'
import {EntryRow} from './EntryRow.js'
import {AnyQueryResult, GraphQuery} from './Graph.js'
import {Mutation} from './Mutation.js'
import {User} from './User.js'

export interface SyncResponse {
  insert: Array<EntryRow>
  remove: Array<string>
}

export interface Syncable {
  syncRequired(contentHash: string): Promise<boolean>
  sync(contentHashes: Array<string>): Promise<SyncResponse>
}

export interface Connection extends Syncable {
  user(): Promise<User | undefined>
  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>>
  previewToken(request: PreviewInfo): Promise<string>
  mutate(mutations: Array<Mutation>): Promise<{commitHash: string}>
  prepareUpload(file: string): Promise<Connection.UploadResponse>
  revisions(file: string): Promise<Array<Revision>>
  revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined>
  getDraft(draftKey: DraftKey): Promise<Draft | undefined>
  storeDraft(draft: Draft): Promise<void>
}

export namespace Connection {
  export interface UploadDestination {
    entryId: string
    location: string
    previewUrl: string
  }
  export interface UploadResponse extends UploadDestination {
    url: string
    method?: string
  }
  export interface MutateParams {
    commitHash: string
    mutations: ChangeSet
  }
}
