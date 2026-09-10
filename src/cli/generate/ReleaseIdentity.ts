import {Config} from '#/core/Config.js'
import {createId} from '#/core/Id.js'
import {replicaScope} from '#/core/ReplicaScope.js'
import {
  checkpointFormat,
  type CheckpointIdentity
} from '#/database/runtime/Checkpoint.js'

/** Deployment identity is separate from content namespace and source epoch. */
export function releaseIdentity(
  config: Config,
  configId: string,
  configLocation: string,
  env: Record<string, string | undefined>
): CheckpointIdentity {
  const {project, namespace, epoch} = dashboardBinding(
    config,
    configLocation,
    env
  )
  if (typeof configId !== 'string' || !configId)
    throw new Error('Replica identity values must be non-empty strings')
  return {
    project,
    namespace,
    epoch,
    configId,
    schemaId: `alinea-sqlite-${checkpointFormat}`,
    releaseId: createId()
  }
}

/** Public source scope embedded in dashboard bundles; never infer preview
 * identity from the browser's hostname or its build-time process environment.
 */
export function dashboardBinding(
  config: Config,
  configLocation: string,
  env: Record<string, string | undefined>
) {
  const project =
    config.replica?.project ??
    Config.baseUrl(config, 'production') ??
    `local:${configLocation}`
  const {namespace, epoch} = replicaScope(config, env)
  if (
    ![project, namespace, epoch].every(
      value =>
        typeof value === 'string' && value.length > 0 && value.length <= 4096
    )
  )
    throw new Error('Replica identity values must be non-empty strings')
  return {project, namespace, epoch}
}
