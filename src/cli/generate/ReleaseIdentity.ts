import {Config} from '#/core/Config.js'
import {createId} from '#/core/Id.js'
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
  const project =
    config.replica?.project ??
    Config.baseUrl(config, 'production') ??
    `local:${configLocation}`
  const namespace =
    config.replica?.namespace ??
    env.VERCEL_GIT_COMMIT_REF ??
    env.CF_PAGES_BRANCH ??
    'main'
  const epoch = config.replica?.epoch ?? '1'
  if (
    ![project, namespace, epoch, configId].every(
      value => typeof value === 'string' && value.length > 0
    )
  )
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
