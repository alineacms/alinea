import {isRecord} from '#/core/util/Objects.js'

export interface ReplicaBinding {
  project: string
  namespace: string
  epoch: string
}

/** Generated public metadata, separate from user authentication and release IDs. */
export function replicaBinding(value: unknown): ReplicaBinding {
  if (
    !isRecord(value) ||
    !['project', 'namespace', 'epoch'].every(
      key =>
        typeof value[key] === 'string' &&
        value[key].length > 0 &&
        value[key].length <= 4096
    )
  )
    throw new Error('Missing generated dashboard replica binding')
  return {
    project: value.project as string,
    namespace: value.namespace as string,
    epoch: value.epoch as string
  }
}
