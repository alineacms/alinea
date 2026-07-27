import type {MutationQueueEntry} from '../boot/MutationQueueEvent.js'

export interface MutationQueueState {
  entries: Array<MutationQueueEntry>
  pending: number
  syncing: number
  failed: number
  blocked: number
  error?: string
}

export function createMutationQueueState(
  entries: Array<MutationQueueEntry>
): MutationQueueState {
  return {
    entries,
    pending: entries.filter(entry => entry.status === 'pending').length,
    syncing: entries.filter(entry => entry.status === 'syncing').length,
    failed: entries.filter(entry => entry.status === 'failed').length,
    blocked: entries.filter(entry => entry.status === 'blocked').length,
    error: entries.find(entry => entry.status === 'failed')?.error
  }
}
