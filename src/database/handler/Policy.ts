import type {Config} from '#/core/Config.js'
import type {Graph} from '#/core/Graph.js'
import {Policy, WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {assert} from '#/core/util/Assert.js'

/** Runs server-side role functions against the complete normalized graph. */
export async function evaluateRolePolicy(
  config: Config,
  graph: Graph,
  roleNames: ReadonlyArray<string>
): Promise<Policy> {
  const roles = config.roles ?? {}
  let result = Policy.ALLOW_NONE
  for (const name of roleNames) {
    const role = roles[name]
    assert(role, `Role ${name} not found in config`)
    const policy = new WriteablePolicy(getScope(config))
    await role.permissions(policy, graph)
    result = result.concat(policy)
  }
  return result
}

export function roleFingerprint(roleNames: ReadonlyArray<string>): string {
  return [...new Set(roleNames)].sort().join('\0')
}
