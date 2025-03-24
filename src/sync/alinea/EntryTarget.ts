import type {Source} from '../Source.ts'
import type {CommitRequest} from './CommitRequest.ts'

export interface EntryTarget extends Source {
  commit(request: CommitRequest): Promise<string>
}
