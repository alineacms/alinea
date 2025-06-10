import type {Graph} from './Graph.js'
import {ErrorCode, HttpError} from './HttpError.js'
import type {HasRoot, HasType, HasWorkspace} from './Internal.js'

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

export type Resource = HasWorkspace | HasRoot | HasType | string

export class ACL extends Map<Resource, number> {
  root = Permission.None
  constructor(acl?: ACL) {
    super(acl)
    if (acl) this.root = acl.root
  }
  get(resource: Resource): number {
    return super.get(resource) ?? 0
  }
}

export type InheritPermissions = (resource: Resource, acl: ACL) => number

export class Policy {
  protected acl = new ACL()

  constructor(protected inherit?: InheritPermissions) {}

  static from(policy: Policy): Policy {
    const result = new Policy(policy.inherit)
    result.acl = new ACL(policy.acl)
    return result
  }

  concat(that: Policy): Policy {
    const result = new Policy(this.inherit)
    const acl = new ACL(this.acl)
    acl.root |= that.acl.root
    for (const [resource, permissions] of that.acl)
      acl.set(resource, permissions | acl.get(resource))
    result.acl = acl
    return result
  }

  #permissionsOf(resource: Resource): number {
    let result = this.acl.root
    result |= this.acl.get(resource)
    if (!this.inherit) return result
    result |= this.inherit(resource, this.acl)
    return result
  }

  #check(permission: number, entity?: Resource): boolean {
    const permissions = entity ? this.#permissionsOf(entity) : this.acl.root
    const allowed = permissions & permission
    const denied = permissions & grant.deny(permission)
    return Boolean(allowed && !denied)
  }

  assert(permission: Permission, entity?: Resource): void {
    if (!this.#check(permission, entity))
      throw new HttpError(ErrorCode.Unauthorized, 'Permission denied')
  }

  canRead(entity: Resource): boolean {
    return this.#check(grant.read, entity)
  }

  canCreate(entity: Resource): boolean {
    return this.#check(grant.create, entity)
  }

  canUpdate(entity: Resource): boolean {
    return this.#check(grant.update, entity)
  }

  canDelete(entity: Resource): boolean {
    return this.#check(grant.delete, entity)
  }

  canReorder(entity: Resource): boolean {
    return this.#check(grant.reorder, entity)
  }

  canMove(entity: Resource): boolean {
    return this.#check(grant.move, entity)
  }

  canPublish(entity: Resource): boolean {
    return this.#check(grant.publish, entity)
  }

  canArchive(entity: Resource): boolean {
    return this.#check(grant.archive, entity)
  }

  canUpload(entity: Resource): boolean {
    return this.#check(grant.upload, entity)
  }

  canExplore(entity: Resource): boolean {
    return this.#check(grant.explore, entity)
  }

  canAll(entity: Resource): boolean {
    const permissions = this.#permissionsOf(entity)
    return (
      (permissions & grant.allowAll) === grant.allowAll &&
      (permissions & grant.denyAll) === 0
    )
  }
}

export class WriteablePolicy extends Policy {
  allowAll(): this {
    this.acl.root = grant.allowAll
    return this
  }

  setAll(permissions: Permissions): this {
    const packed = grant.pack(permissions)
    this.acl.root |= packed
    return this
  }

  #apply(resource: Resource, permissions: Permissions): this {
    const packed = grant.pack(permissions)
    this.acl.set(resource, packed)
    return this
  }

  setWorkspace(workspace: HasWorkspace, permissions: Permissions): this {
    return this.#apply(workspace, permissions)
  }

  setRoot(
    root: HasRoot,
    permissions: Permissions | Record<string, number>
  ): this {
    return this.#apply(root, permissions)
  }

  setType(type: HasType, permissions: Permissions): this {
    return this.#apply(type, permissions)
  }

  setEntry(entryId: string, permissions: Permissions): this {
    return this.#apply(entryId, permissions)
  }
}

export namespace Policy {
  export const ALLOW_ALL = Policy.from(new WriteablePolicy().allowAll())
  export const DENY_ALL = new Policy()
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
