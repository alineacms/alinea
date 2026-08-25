import type {HandlerKeyCatalog} from '../release/Exporter.js'
import type {
  AccessClassGrant,
  AccessClassId,
  FrameDescriptor,
  ReplicaCatalog,
  ReplicaState,
  ViewId
} from '../replica/Types.js'

export interface ProjectReplicaStateOptions {
  viewId: ViewId
  catalog: ReplicaCatalog
  keys: HandlerKeyCatalog
  accessClasses: ReadonlySet<AccessClassId>
  recordAccess: ReplicaState['recordAccess']
}

/**
 * Creates the authenticated catalog. The public bundle remains unchanged, but
 * clients only learn descriptors and keys for their effective policy view.
 */
export function projectReplicaState(
  options: ProjectReplicaStateOptions
): ReplicaState {
  assertMatchingRelease(options.catalog, options.keys)
  const records = Object.fromEntries(
    Object.entries(options.catalog.records).filter(([, frame]) =>
      options.accessClasses.has(frame.accessClassId)
    )
  )
  const indexes: Record<string, ReadonlyArray<FrameDescriptor>> = {}
  for (const [key, fragments] of Object.entries(options.catalog.indexes)) {
    const granted = fragments.filter(frame =>
      options.accessClasses.has(frame.accessClassId)
    )
    if (granted.length > 0) indexes[key] = granted
  }
  const used = new Set<AccessClassId>()
  for (const frame of Object.values(records)) used.add(frame.accessClassId)
  for (const fragments of Object.values(indexes))
    for (const frame of fragments) used.add(frame.accessClassId)
  const grants: Array<AccessClassGrant> = []
  for (const accessClassId of used) {
    const key = options.keys.accessClasses[accessClassId]
    if (!key)
      throw new Error(`Missing handler key for access class "${accessClassId}"`)
    grants.push({accessClassId, key: key.slice()})
  }
  const recordAccess = Object.fromEntries(
    Object.entries(options.recordAccess).filter(([id]) => id in records)
  )
  return {
    viewId: options.viewId,
    catalog: {...options.catalog, records, indexes},
    grants,
    recordAccess
  }
}

function assertMatchingRelease(
  catalog: ReplicaCatalog,
  keys: HandlerKeyCatalog
): void {
  if (catalog.bundleId !== keys.bundleId)
    throw new Error('Catalog and handler keys refer to different bundles')
  if (catalog.revision !== keys.revision)
    throw new Error('Catalog and handler keys refer to different revisions')
}
