import {assert} from 'alinea/core/util/Assert'
import type {Graph} from './Graph.js'
import {ErrorCode, HttpError} from './HttpError.js'
import type {HasRoot, HasType, HasWorkspace} from './Internal.js'
import {type Scope, ScopeKey} from './Scope.js'

interface SetPermissions {
  workspace?: never
  root?: never
  type?: never
  id?: never
  locale?: never
  /**
   * Specifies the permission evaluation strategy.
   * - 'inherit' (default): Permissions granted at a higher level (e.g., workspace) are sufficient.
   * - 'explicit': A specific 'allow' permission must exist on the target entity itself.
   */
  grant?: 'inherit' | 'explicit'
  allow?: Partial<Permissions>
  deny?: Partial<Permissions>
}

interface WorkspacePermission extends Omit<SetPermissions, 'workspace'> {
  workspace: HasWorkspace
}
interface RootPermission extends Omit<SetPermissions, 'root'> {
  root: HasRoot
}
interface TypePermission extends Omit<SetPermissions, 'type'> {
  type: HasType
}
interface IdPermission extends Omit<SetPermissions, 'id'> {
  id: string
}
interface LocalePermission extends Omit<SetPermissions, 'locale'> {
  locale: string | null
}

export type PermissionInput =
  | SetPermissions
  | WorkspacePermission
  | RootPermission
  | TypePermission
  | IdPermission
  | LocalePermission

export interface Permissions {
  create: boolean
  read: boolean
  update: boolean
  delete: boolean
  reorder: boolean
  move: boolean
  publish: boolean
  archive: boolean
  upload: boolean
  explore: boolean
  all: boolean
}

let total = 0
export enum Permission {
  None = 0,
  Create = 1 << total++,
  Read = 1 << total++,
  Update = 1 << total++,
  Delete = 1 << total++,
  Reorder = 1 << total++,
  Move = 1 << total++,
  Publish = 1 << total++,
  Archive = 1 << total++,
  Upload = 1 << total++,
  Explore = 1 << total++,
  All = (1 << total) - 1,
  Explicit = 1 << total++
}

const permissionMap = {
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
  all: Permission.All
}

const DENY_MASK = ~((1 << total) - 1)

function combine(a: Permission, b: Permission): Permission {
  const inheritAllows = !(a & Permission.Explicit)
  if (inheritAllows) return a | b
  // Carry over only denies, but not allows
  const inheritedDenies = a & DENY_MASK
  return inheritedDenies | b
}

function deny(permission: Permission): number {
  return permission << total
}

function pack(input: PermissionInput): number {
  let result = 0
  if (input.grant === 'explicit') result |= Permission.Explicit
  if (input.allow)
    for (const [name, state] of Object.entries(input.allow)) {
      if (state) result |= permissionMap[name as keyof Permissions]
    }
  if (input.deny)
    for (const [name, state] of Object.entries(input.deny)) {
      if (state) result |= deny(permissionMap[name as keyof Permissions])
    }
  if (!input.allow && !input.deny) {
    throw new Error('No permissions specified to allow or deny')
  }
  return result
}

function entitlements(packed: number): Permissions {
  return {
    create: Boolean(packed & Permission.Create),
    read: Boolean(packed & Permission.Read),
    update: Boolean(packed & Permission.Update),
    delete: Boolean(packed & Permission.Delete),
    reorder: Boolean(packed & Permission.Reorder),
    move: Boolean(packed & Permission.Move),
    publish: Boolean(packed & Permission.Publish),
    archive: Boolean(packed & Permission.Archive),
    upload: Boolean(packed & Permission.Upload),
    explore: Boolean(packed & Permission.Explore),
    all: Boolean(packed & Permission.All)
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
  equals(that: ACL): boolean {
    if (this.root !== that.root) return false
    if (this.size !== that.size) return false
    for (const [key, value] of this) {
      if (that.get(key) !== value) return false
    }
    return true
  }
}

export class Policy {
  static ALLOW_ALL = new Policy(Permission.All)
  static ALLOW_NONE = new Policy(Permission.None)

  protected acl = new ACL()

  constructor(root?: Permission) {
    if (root !== undefined) this.acl.root = root
  }

  static from(policy: Policy): Policy {
    const result = new Policy()
    result.acl = new ACL(policy.acl)
    return result
  }

  equals(that: Policy): boolean {
    return this.acl.equals(that.acl)
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

  #permissionsOf(resource?: Resource): number {
    let result = this.acl.root
    if (!resource) return result
    assert(typeof resource === 'object', 'Resource must be an object')
    if (resource.workspace) {
      const workspacePermission = this.acl.get(
        ScopeKey.workspace(resource.workspace)
      )
      result = combine(result, workspacePermission)
      if (resource.root) {
        const rootPermission = this.acl.get(
          ScopeKey.root(resource.workspace, resource.root)
        )
        result = combine(result, rootPermission)
      }
    }
    if (resource.parents) {
      for (const parent of resource.parents) {
        const parentPermission = this.acl.get(ScopeKey.entry(parent))
        result = combine(result, parentPermission)
      }
    }
    if (resource.type) {
      const typePermission = this.acl.get(ScopeKey.type(resource.type))
      result = combine(result, typePermission)
    }
    if (resource.locale !== undefined) {
      const localePermission = this.acl.get(ScopeKey.locale(resource.locale))
      result = combine(result, localePermission)
    }
    if (resource.id) {
      const entryPermission = this.acl.get(ScopeKey.entry(resource.id))
      result = combine(result, entryPermission)
    }
    return result
  }

  check(permission: Permission, resource?: Resource): boolean {
    const permissions = this.#permissionsOf(resource)
    return (
      (permissions & permission) === permission &&
      (permissions & deny(permission)) === 0
    )
  }

  assert(permission: Permission, resource?: Resource): void {
    if (!this.check(permission, resource))
      throw new HttpError(ErrorCode.Unauthorized, 'Permission denied')
  }

  get(resource?: Resource): Permissions {
    return entitlements(this.#permissionsOf(resource))
  }

  canRead(resource?: Resource): boolean {
    return this.check(Permission.Read, resource)
  }

  canCreate(resource?: Resource): boolean {
    return this.check(Permission.Create, resource)
  }

  canUpdate(resource?: Resource): boolean {
    return this.check(Permission.Update, resource)
  }

  canDelete(resource?: Resource): boolean {
    return this.check(Permission.Delete, resource)
  }

  canReorder(resource?: Resource): boolean {
    return this.check(Permission.Reorder, resource)
  }

  canMove(resource?: Resource): boolean {
    return this.check(Permission.Move, resource)
  }

  canPublish(resource?: Resource): boolean {
    return this.check(Permission.Publish, resource)
  }

  canArchive(resource?: Resource): boolean {
    return this.check(Permission.Archive, resource)
  }

  canUpload(resource?: Resource): boolean {
    return this.check(Permission.Upload, resource)
  }

  canExplore(resource?: Resource): boolean {
    return this.check(Permission.Explore, resource)
  }

  canAll(resource?: Resource): boolean {
    return this.check(Permission.All, resource)
  }
}

export class WriteablePolicy extends Policy {
  #scope: Scope
  constructor(scope: Scope) {
    super()
    this.#scope = scope
  }

  allowAll(): this {
    this.acl.root = Permission.All
    return this
  }

  #apply(key: string, input: PermissionInput): this {
    const packed = pack(input)
    this.acl.set(key, packed)
    return this
  }

  set(...inputs: Array<PermissionInput>): this {
    for (const input of inputs) {
      if (input.workspace)
        this.#apply(this.#scope.keyOf(input.workspace), input)
      else if (input.root) this.#apply(this.#scope.keyOf(input.root), input)
      else if (input.type) this.#apply(this.#scope.keyOf(input.type), input)
      else if (input.id) this.#apply(ScopeKey.entry(input.id), input)
      else if (input.locale !== undefined)
        this.#apply(ScopeKey.locale(input.locale), input)
      else this.acl.root |= pack(input)
    }
    return this
  }
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
