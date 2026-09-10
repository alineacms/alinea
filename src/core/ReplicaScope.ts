import type {Config} from './Config.js'

/** Source identity is stable across releases, but changes on a history reset. */
export function replicaScope(
  config: Config,
  env: Record<string, string | undefined>
) {
  const namespace =
    config.replica?.namespace ??
    env.VERCEL_GIT_COMMIT_REF ??
    env.CF_PAGES_BRANCH ??
    'main'
  const epoch = config.replica?.epoch ?? '1'
  if (
    ![namespace, epoch].every(
      value => typeof value === 'string' && value.length > 0
    )
  )
    throw new Error('Replica identity values must be non-empty strings')
  return {namespace, epoch}
}
