export interface MutationQueueEntry {
  id: string
  status: 'pending' | 'syncing' | 'failed' | 'blocked'
  mutations: Array<MutationQueueMutation>
  error?: string
  upload?: MutationQueueUpload
}

export interface MutationQueueUpload {
  workspace: string
  root?: string
  parentId?: string
}

export interface MutationQueueMutation {
  op: string
  target?: string
  title?: string
  locale?: string | null
  status?: string
  progress?: MutationQueueProgress
}

export interface MutationQueueProgress {
  loaded: number
  total?: number
}

export class MutationQueueEvent extends Event {
  static readonly type = 'mutationqueue'

  constructor(public entries: Array<MutationQueueEntry>) {
    super(MutationQueueEvent.type)
  }
}
