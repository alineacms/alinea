import type {Source} from '../Source.js'
import type {CommitRequest} from './CommitRequest.js'

export interface EntryTarget extends Source {
  commit(request: CommitRequest): Promise<string>
}
