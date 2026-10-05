import {assert} from '#/core/util/Assert.js'
import type {Field} from './Field.js'
import type {Graph} from './Graph.js'
import {ErrorCode, HttpError} from './HttpError.js'
import type {HasRoot, HasType, HasWorkspace} from './Internal.js'
import {type Scope, ScopeKey} from './Scope.js'

interface SetPermissions {
  workspace?: never
  root?: never
  type?: never
  field?: never
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
interface FieldPermission extends Omit<SetPermissions, 'field'> {
  field: Field
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
  | FieldPermission
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
  /**
   * Find entries in pickers, for example to link to them, without opening
   * them in the dashboard. Allowing `read` allows `explore` as well.
   */
  explore: boolean
  manageMembers: boolean
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
  ManageMembers = 1 << total++,
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
  manageMembers: Permission.ManageMembers,
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
  // What you can read you can also find in pickers, and what you can't read
  // you can't find unless explore is allowed
  if (input.allow?.read) result |= Permission.Explore
  if (input.deny?.read && !input.allow?.explore)
    result |= deny(Permission.Explore)
  if (input.deny)
    for (const [name, state] of Object.entries(input.deny)) {
      if (state) result |= deny(permissionMap[name as keyof Permissions])
    }
  if (!input.allow && !input.deny) {
    throw new Error('No permissions specified to allow or deny')
  }
  return result
}

function allowed(packed: number): number {
  return packed & Permission.All & ~(packed >> total)
}

function isAllowed(permissions: number, permission: Permission): boolean {
  return (permissions & permission) === permission
}

function entitlements(packed: number): Permissions {
  return {
    create: isAllowed(packed, Permission.Create),
    read: isAllowed(packed, Permission.Read),
    update: isAllowed(packed, Permission.Update),
    delete: isAllowed(packed, Permission.Delete),
    reorder: isAllowed(packed, Permission.Reorder),
    move: isAllowed(packed, Permission.Move),
    publish: isAllowed(packed, Permission.Publish),
    archive: isAllowed(packed, Permission.Archive),
    upload: isAllowed(packed, Permission.Upload),
    explore: isAllowed(packed, Permission.Explore),
    manageMembers: isAllowed(packed, Permission.ManageMembers),
    all: isAllowed(packed, Permission.All)
  }
}

export interface Resource {
  workspace?: string
  root?: string
  type?: string
  field?: string
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
  resolve(resource?: Resource): number {
    let result = this.root
    if (!resource) return result
    assert(typeof resource === 'object', 'Resource must be an object')
    if (resource.workspace) {
      result = combine(result, this.get(ScopeKey.workspace(resource.workspace)))
      if (resource.root)
        result = combine(
          result,
          this.get(ScopeKey.root(resource.workspace, resource.root))
        )
    }
    if (resource.parents)
      for (const parent of resource.parents)
        result = combine(result, this.get(ScopeKey.entry(parent)))
    if (resource.type) {
      result = combine(result, this.get(ScopeKey.type(resource.type)))
      if (resource.field) {
        // A field of an object field inherits from the fields containing it
        const path = resource.field.split('.')
        for (let i = 1; i <= path.length; i++)
          result = combine(
            result,
            this.get(ScopeKey.field(resource.type, path.slice(0, i).join('.')))
          )
      }
    }
    if (resource.locale !== undefined)
      result = combine(result, this.get(ScopeKey.locale(resource.locale)))
    if (resource.id)
      result = combine(result, this.get(ScopeKey.entry(resource.id)))
    return result
  }
}

export class Policy {
  static ALLOW_ALL = new Policy(Permission.All)
  static ALLOW_NONE = new Policy(Permission.None)

  // Every role resolves on its own: a deny is absolute within its role, but
  // another role of the same user can still allow the action
  protected acls: Array<ACL> = [new ACL()]

  constructor(root?: Permission) {
    if (root !== undefined) this.acls[0].root = root
  }

  static from(policy: Policy): Policy {
    const result = new Policy()
    result.acls = policy.acls.map(acl => new ACL(acl))
    return result
  }

  equals(that: Policy): boolean {
    return (
      this.acls.length === that.acls.length &&
      this.acls.every((acl, i) => acl.equals(that.acls[i]))
    )
  }

  concat(that: Policy): Policy {
    const result = new Policy()
    result.acls = [...this.acls, ...that.acls].map(acl => new ACL(acl))
    return result
  }

  #permissionsOf(resource?: Resource): number {
    let result = Permission.None
    for (const acl of this.acls) result |= allowed(acl.resolve(resource))
    return result
  }

  check(permission: Permission, resource?: Resource): boolean {
    return isAllowed(this.#permissionsOf(resource), permission)
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

  canManageMembers(): boolean {
    return this.check(Permission.ManageMembers)
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

  get #acl(): ACL {
    return this.acls[0]
  }

  allowAll(): this {
    this.#acl.root = Permission.All
    return this
  }

  #apply(key: string, input: PermissionInput): this {
    const packed = pack(input)
    this.#acl.set(key, packed)
    return this
  }

  set(...inputs: Array<PermissionInput>): this {
    for (const input of inputs) {
      if (input.workspace)
        this.#apply(this.#scope.keyOf(input.workspace), input)
      else if (input.root) this.#apply(this.#scope.keyOf(input.root), input)
      else if (input.type) this.#apply(this.#scope.keyOf(input.type), input)
      else if (input.field) this.#apply(this.#scope.keyOf(input.field), input)
      else if (input.id) this.#apply(ScopeKey.entry(input.id), input)
      else if (input.locale !== undefined)
        this.#apply(ScopeKey.locale(input.locale), input)
      else this.#acl.root |= pack(input)
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
