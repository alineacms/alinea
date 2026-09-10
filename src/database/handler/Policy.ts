import type {Config} from '#/core/Config.js'
import type {Graph} from '#/core/Graph.js'
import {
  Permission,
  Policy,
  WritablePolicy,
  effectivePermissions as compiledPermissions
} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {compareStrings, sha256Hash} from '#/core/source/Utils.js'
import type {IndexedEntry} from '../entry/Schema.js'
import {entryIndexRow} from '../entry/Schema.js'
import type {EntryRuntime} from '../runtime/EntryRuntime.js'

export interface AuthorizedEntry {
  entry: IndexedEntry
  permissions: number
  payloadId?: string
}

/** Role functions execute only against the trusted handler graph. */
export async function evaluateRolePolicy(
  config: Config,
  graph: Graph,
  names: ReadonlyArray<string>
): Promise<Policy> {
  let policy = Policy.ALLOW_NONE
  for (const name of new Set(names)) {
    const role =
      config.roles && Object.hasOwn(config.roles, name)
        ? config.roles[name]
        : undefined
    if (!role) throw new Error(`Role ${name} not found in config`)
    const current = new WritablePolicy(getScope(config))
    await role.permissions(current, graph)
    policy = policy.concat(current)
  }
  return policy
}

/** Hash includes denials and field rules, even when today's visible rows are unchanged. */
export async function policyFingerprint(policy: Policy): Promise<string> {
  const data = policy.data()
  data.entries.sort(([left], [right]) => compareStrings(left, right))
  const bytes = new TextEncoder().encode(
    JSON.stringify(['alinea.policy.v1', data])
  )
  return sha256Hash(bytes)
}

export {compiledPermissions}

/** Materialize a complete policy view without reading payloads just to export rows. */
export function authorizedIndex(
  runtime: EntryRuntime,
  roles: ReadonlyArray<string>
) {
  return runtime.readConsistent(async () => {
    const policy = await evaluateRolePolicy(runtime.config, runtime, roles)
    const snapshot = await runtime.indexSnapshot()
    const entries: Array<AuthorizedEntry> = []
    for (const replacement of snapshot.entries) {
      if (replacement.entry.visible === false) continue
      const {versionId: _, ...entry} = entryIndexRow(replacement.entry)
      const permissions = compiledPermissions(policy, entry)
      if (!(permissions & Permission.Explore)) continue
      const fieldPermissions = Object.keys(
        runtime.config.schema[entry.type] ?? {}
      ).map(field => compiledPermissions(policy, {...entry, field}))
      const read = Boolean(permissions & Permission.Read)
      if (fieldPermissions.some(bits => bits !== permissions))
        throw new Error(
          'Field-level permissions are not supported by SQLite replicas'
        )
      entries.push({
        entry,
        permissions,
        ...(read && replacement.payloadId
          ? {payloadId: replacement.payloadId}
          : {})
      })
    }
    // Preserve generic/creation checks without leaking rules for hidden entries.
    // Ancestor IDs already occur in the authorized rows' structural metadata.
    const visibleIds = new Set(
      entries.flatMap(({entry}) => [entry.id, ...entry.parents])
    )
    const scopePolicy = policy.data()
    scopePolicy.entries = scopePolicy.entries.filter(
      ([key]) => !key.startsWith('Entry.') || visibleIds.has(key.slice(6))
    )
    return {
      revision: snapshot.revision,
      viewId: await policyFingerprint(policy),
      permissions: compiledPermissions(policy),
      scopePolicy,
      entries
    }
  })
}
