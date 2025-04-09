export class IndexEvent extends Event {
  static readonly type = 'index'
  constructor(public data: IndexOp) {
    super(IndexEvent.type)
  }
}

export type IndexOp =
  | {op: 'index'; sha: string}
  | {op: 'entry'; id: string}
  | {
      op: 'mutate'
      id: string
      status: 'pending' | 'success' | 'failure'
      error?: Error
    }
