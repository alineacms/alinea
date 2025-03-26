import type {SyncableSource} from '../source/Source.js'
import type {CommitRequest} from './CommitRequest.js'

export interface EntryTarget extends SyncableSource {
  commit(request: CommitRequest): Promise<string>
}
