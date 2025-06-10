import type {Graph} from './Graph.js'
import {ErrorCode, HttpError} from './HttpError.js'
import type {HasRoot, HasType, HasWorkspace} from './Internal.js'
import {type Scope, ScopeKey} from './Scope.js'
import {assert} from './source/Utils.js'

type SetPermissions =
  | {workspace: HasWorkspace; grant: Permissions}
  | {type: HasType; grant: Permissions}
  | {root: HasRoot; grant: Permissions}
  | {id: string; grant: Permissions}

interface Permissions {
  create?: boolean
  read?: boolean
  update?: boolean
  delete?: boolean
  reorder?: boolean
  move?: boolean
  publish?: boolean
  archive?: boolean
  upload?: boolean
  explore?: boolean
}

const total = 10
export enum Permission {
  None = 0,
  Create = 1 << 0,
  Read = 1 << 1,
  Update = 1 << 2,
  Delete = 1 << 3,
  Reorder = 1 << 4,
  Move = 1 << 5,
  Publish = 1 << 6,
  Archive = 1 << 7,
  Upload = 1 << 8,
  Explore = 1 << 9,
  All = (1 << total) - 1
}
const grant = {
  create: Permission.Create,
  read: Permission.Read,
  update: Permission.Update,
  delete: Permission.Delete,
  reorder: Permission.Reorder,
  move: Permission.Move,
  publish: Permission.Publish,
  archive: Permission.Archive,
  upload: Permission.Upload,
  explore: Permission.Explore,

  allowAll: (1 << total) - 1,
  denyAll: ((1 << total) - 1) << total,

  deny(permission: Permission): number {
    return permission << total
  },

  pack(permissions: Permissions): number {
    let packed = 0
    for (const [name, state] of Object.entries(permissions) as Array<
      [keyof Permissions, boolean | undefined]
    >) {
      if (!(name in this)) continue
      if (state === undefined) continue
      if (state) packed |= this[name]
      else packed |= this.deny(this[name])
    }
    return packed
  }
}

export interface Resource {
  workspace?: string
  root?: string
  type?: string
  id?: string
  parents?: Array<string>
  locale?: string | null
}

export class ACL extends Map<string, number> {
  root = Permission.None
  constructor(acl?: ACL) {
    super(acl)
    if (acl) this.root = acl.root
  }
  get(resource: string): number {
    return super.get(resource) ?? 0
  }
}

export class Policy {
  protected acl = new ACL()

  constructor(root?: Permission) {
    if (root !== undefined) this.acl.root = root
  }

  static from(policy: Policy): Policy {
    const result = new Policy()
    result.acl = new ACL(policy.acl)
    return result
  }

  concat(that: Policy): Policy {
    const result = new Policy()
    const acl = new ACL(this.acl)
    acl.root |= that.acl.root
    for (const [key, permissions] of that.acl)
      acl.set(key, permissions | acl.get(key))
    result.acl = acl
    return result
  }

  #permissionsOf(resource: Resource): number {
    let result = this.acl.root
    assert(typeof resource === 'object', 'Resource must be an object')
    if (resource.id) result |= this.acl.get(ScopeKey.entry(resource.id))
    if (resource.type) result |= this.acl.get(ScopeKey.type(resource.type))
    if (resource.workspace)
      result |= this.acl.get(ScopeKey.workspace(resource.workspace))
    if (resource.workspace && resource.root)
      result |= this.acl.get(ScopeKey.root(resource.workspace, resource.root))
    if (resource.parents) {
      for (const parent of resource.parents) {
        result |= this.acl.get(ScopeKey.entry(parent))
      }
    }
    return result
  }

  check(permission: number, resource?: Resource): boolean {
    const permissions = resource ? this.#permissionsOf(resource) : this.acl.root
    const allowed = permissions & permission
    const denied = permissions & grant.deny(permission)
    return Boolean(allowed && !denied)
  }

  assert(permission: Permission, resource?: Resource): void {
    if (!this.check(permission, resource))
      throw new HttpError(ErrorCode.Unauthorized, 'Permission denied')
  }

  canRead(resource?: Resource): boolean {
    return this.check(grant.read, resource)
  }

  canCreate(resource?: Resource): boolean {
    return this.check(grant.create, resource)
  }

  canUpdate(resource?: Resource): boolean {
    return this.check(grant.update, resource)
  }

  canDelete(resource?: Resource): boolean {
    return this.check(grant.delete, resource)
  }

  canReorder(resource?: Resource): boolean {
    return this.check(grant.reorder, resource)
  }

  canMove(resource?: Resource): boolean {
    return this.check(grant.move, resource)
  }

  canPublish(resource?: Resource): boolean {
    return this.check(grant.publish, resource)
  }

  canArchive(resource?: Resource): boolean {
    return this.check(grant.archive, resource)
  }

  canUpload(resource?: Resource): boolean {
    return this.check(grant.upload, resource)
  }

  canExplore(resource?: Resource): boolean {
    return this.check(grant.explore, resource)
  }

  canAll(resource?: Resource): boolean {
    const permissions = resource ? this.#permissionsOf(resource) : this.acl.root
    return (
      (permissions & grant.allowAll) === grant.allowAll &&
      (permissions & grant.denyAll) === 0
    )
  }
}

export class WriteablePolicy extends Policy {
  #scope: Scope
  constructor(scope: Scope) {
    super()
    this.#scope = scope
  }

  allowAll(): this {
    this.acl.root = grant.allowAll
    return this
  }

  setAll(permissions: Permissions): this {
    const packed = grant.pack(permissions)
    this.acl.root |= packed
    return this
  }

  #apply(key: string, permissions: Permissions): this {
    const packed = grant.pack(permissions)
    this.acl.set(key, packed)
    return this
  }

  set(set: SetPermissions): this {
    const subject =
      'workspace' in set
        ? set.workspace
        : 'root' in set
          ? set.root
          : 'type' in set
            ? set.type
            : set.id
    const key =
      typeof subject === 'string'
        ? ScopeKey.entry(subject)
        : this.#scope.keyOf(subject)
    return this.#apply(key, set.grant)
  }
}

export namespace Policy {
  export const ALLOW_ALL = new Policy(Permission.All)
  export const ALLOW_NONE = new Policy(Permission.None)
}

export interface RoleOptions {
  description?: string
  permissions(policy: WriteablePolicy, graph: Graph): void | Promise<void>
}

export interface Role extends RoleOptions {
  label: string
}

export function role(label: string, config: RoleOptions) {
  return {
    label,
    ...config
  }
}

export const admin = role('Admin', {
  description: 'Has full access to all features of the CMS',
  permissions(policy) {
    policy.allowAll()
  }
})
