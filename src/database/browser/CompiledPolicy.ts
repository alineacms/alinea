import {
  Permission,
  Policy,
  effectivePermissions,
  permissionFlags,
  type Permissions,
  type Resource
} from '#/core/Role.js'
import type {IndexBootstrap} from '../replica/Bootstrap.js'
import type {CachedEntry} from './ReplicaCache.js'

/** Synchronous UI checks from authenticated grants, without executing roles in the browser. */
export class CompiledPolicy extends Policy {
  #scope: Policy
  #entries = new Map<string, Array<CachedEntry>>()
  #identity: string
  #revision: string

  constructor(view: IndexBootstrap) {
    super()
    this.#scope = Policy.fromData(view.scopePolicy)
    this.#identity = JSON.stringify(view.identity)
    this.#revision = view.revision
    for (const row of structuredClone(view.entries)) {
      const entries = this.#entries.get(row.entry.id) ?? []
      entries.push(row)
      this.#entries.set(row.entry.id, entries)
    }
  }

  #permissions(resource?: Resource): number {
    if (!resource?.id) return effectivePermissions(this.#scope, resource)
    const rows = this.#entries
      .get(resource.id)
      ?.filter(
        ({entry}) =>
          (resource.locale === undefined ||
            entry.locale === (resource.locale?.toLowerCase() ?? null)) &&
          (!resource.workspace || resource.workspace === entry.workspace) &&
          (!resource.root || resource.root === entry.root) &&
          (!resource.type || resource.type === entry.type)
      )
    if (!rows?.length) return Permission.None
    // Unspecified locale/version must not widen authority across authored rows.
    let bits = Permission.All
    for (const row of rows) bits &= row.permissions
    return bits
  }

  override check(permission: Permission, resource?: Resource): boolean {
    return (this.#permissions(resource) & permission) === permission
  }

  override get(resource?: Resource): Permissions {
    return permissionFlags(this.#permissions(resource))
  }

  override equals(that: Policy): boolean {
    return (
      that instanceof CompiledPolicy &&
      this.#identity === that.#identity &&
      this.#revision === that.#revision
    )
  }

  override data(): never {
    throw new Error('Compiled UI permissions are not an authority policy')
  }

  override concat(): never {
    throw new Error('Compiled UI permissions cannot be combined locally')
  }
}
