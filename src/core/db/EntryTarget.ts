import type {RemoteSource} from '../source/Source.js'
import type {CommitRequest} from './CommitRequest.js'

export interface EntryTarget extends RemoteSource {
  commit(request: CommitRequest): Promise<string>
}
