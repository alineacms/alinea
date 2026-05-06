export interface MutationQueueEntry {
  id: string
  status: 'pending' | 'syncing' | 'failed' | 'blocked'
  mutations: Array<MutationQueueMutation>
  error?: string
}

export interface MutationQueueMutation {
  op: string
  target?: string
  locale?: string | null
  status?: string
}

export class MutationQueueEvent extends Event {
  static readonly type = 'mutationqueue'

  constructor(public entries: Array<MutationQueueEntry>) {
    super(MutationQueueEvent.type)
  }
}
