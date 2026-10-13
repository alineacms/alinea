/**
 * The dashboard's store saved base `key` in full: a worker of its own can
 * store a compacted copy of it, which the store then adopts.
 */
export class CompactEvent extends Event {
  static readonly type = 'compact'

  constructor(public key: string) {
    super(CompactEvent.type)
  }
}
