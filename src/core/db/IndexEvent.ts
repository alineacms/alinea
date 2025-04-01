export class IndexEvent extends Event {
  constructor(type: IndexUpdate['type'] | EntryUpdate['type']) {
    super(type)
  }
}

export class IndexUpdate extends IndexEvent {
  static readonly type = 'index'
  constructor(public sha: string) {
    super(IndexUpdate.type)
  }
}

export class EntryUpdate extends IndexEvent {
  static readonly type = 'entry'
  constructor(public id: string) {
    super(EntryUpdate.type)
  }
}
