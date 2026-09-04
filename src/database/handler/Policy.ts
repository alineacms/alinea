import type {Config} from '#/core/Config.js'
import type {Graph} from '#/core/Graph.js'
import {Policy, WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {assert} from '#/core/util/Assert.js'
import {sha1Hash} from '#/core/source/Utils.js'

/** Runs server-side role functions against the complete runtime graph. */
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

export function policyFingerprint(policy: Policy): Promise<string> {
  const data = policy.data()
  const stable = {
    root: data.root,
    entries: [...data.entries].sort(([left], [right]) =>
      left.localeCompare(right)
    )
  }
  return sha1Hash(new TextEncoder().encode(JSON.stringify(stable)))
}
