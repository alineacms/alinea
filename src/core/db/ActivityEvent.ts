export type ActivityType = 'mutation' | 'fetch' | 'upload'

export type ActivityStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'blocked'
  | 'discarded'
  | 'cancelled'

export interface Activity {
  id: string
  type: ActivityType
  status: ActivityStatus
  operations: Array<ActivityOperation>
  target?: ActivityTarget
  startedAt: number
  finishedAt?: number
  error?: string
  upload?: ActivityUpload
}

export interface ActivityTarget {
  workspace: string
  root: string
  entry: string
  locale?: string | null
}

export interface ActivityUpload {
  workspace: string
  root?: string
  parentId?: string
}

export interface ActivityOperation {
  op: string
  target?: string
  title?: string
  locale?: string | null
  status?: string
  progress?: ActivityProgress
}

export interface ActivityProgress {
  loaded: number
  total?: number
}

export interface ActivitySource {
  activities(): Promise<Array<Activity>>
}

export class ActivityEvent extends Event {
  static readonly type = 'activity'

  constructor(public activities: Array<Activity>) {
    super(ActivityEvent.type)
  }
}
