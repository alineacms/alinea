export class IndexEvent extends Event {
  static readonly type = 'index'
  constructor(public data: IndexOp) {
    super(IndexEvent.type)
  }
}

export type IndexOp =
  | {
      op: 'index'
      sha: string
      ids: Array<string>
      queries?: Array<string> | 'all'
    }
  | {
      op: 'references'
      scanned: number
      total: number
      complete: boolean
    }
  | {
      op: 'mutate'
      id: string
      status: 'pending' | 'success' | 'failure'
      error?: Error
    }
