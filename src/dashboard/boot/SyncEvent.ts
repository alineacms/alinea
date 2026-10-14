import type {SyncProgress} from '#/core/db/LocalStore.js'

/** Progress of a sync from the remote, without progress once it finished. */
export class SyncEvent extends Event {
  static readonly type = 'sync'

  constructor(public progress?: SyncProgress) {
    super(SyncEvent.type)
  }
}
