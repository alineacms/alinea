import type {Revision} from 'alinea/backend/Backend'
import type {PreviewInfo} from 'alinea/backend/Previews'
import type {ChangeSet} from 'alinea/backend/data/ChangeSet'
import type {Draft, DraftKey} from './Draft.js'
import type {EntryRecord} from './EntryRecord.js'
import type {EntryRow} from './EntryRow.js'
import type {AnyQueryResult, GraphQuery} from './Graph.js'
import type {User} from './User.js'
import type {CommitRequest} from './db/CommitRequest.js'
import type {SyncableSource} from './source/Source.js'

export interface SyncResponse {
  insert: Array<EntryRow>
  remove: Array<string>
}

export interface Syncable {
  syncRequired(contentHash: string): Promise<boolean>
  sync(contentHashes: Array<string>): Promise<SyncResponse>
}

export interface Connection extends SyncableSource {
  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>>
  commit(request: CommitRequest): Promise<string>
  user(): Promise<User | undefined>
  previewToken(request: PreviewInfo): Promise<string>
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
