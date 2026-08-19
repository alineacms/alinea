import type {PolicyData} from '#/core/Role.js'

export class ContentStateEvent extends Event {
  static readonly type = 'content-state'

  constructor(public policy: PolicyData) {
    super(ContentStateEvent.type)
  }
}
