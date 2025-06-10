import type {Graph} from './Graph.js'
import type {HasRoot, HasType, HasWorkspace} from './Internal.js'
import type {EntryIndex} from './db/EntryIndex.js'

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
const grant = {
  create: 0,
  read: 1,
  update: 2,
  delete: 3,
  reorder: 4,
  move: 5,
  publish: 6,
  archive: 7,
  upload: 8,
  explore: 9,

  allowAll: (1 << total) - 1,
  denyAll: ((1 << total) - 1) << total,
  allow(permission: number): number {
    return 1 << permission
  },
  deny(permission: number): number {
    return 1 << (permission + total)
  },

  pack(permissions: Permissions): number {
    let packed = 0
    for (const [name, state] of Object.entries(permissions) as Array<
      [keyof Permissions, boolean | undefined]
    >) {
      if (!(name in this)) continue
      if (state === undefined) continue
      if (state) packed |= this.allow(this[name])
      else packed |= this.deny(this[name])
    }
    return packed
  }
}

export type Resource = HasWorkspace | HasRoot | HasType | string

export class ACL extends Map<Resource, number> {
  root = 0
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

  #check(entity: Resource, permission: number): boolean {
    const permissions = this.#permissionsOf(entity)
    const allowed = permissions & grant.allow(permission)
    const denied = permissions & grant.deny(permission)
    return Boolean(allowed && !denied)
  }

  canRead(entity: Resource): boolean {
    return this.#check(entity, grant.read)
  }

  canCreate(entity: Resource): boolean {
    return this.#check(entity, grant.create)
  }

  canUpdate(entity: Resource): boolean {
    return this.#check(entity, grant.update)
  }

  canDelete(entity: Resource): boolean {
    return this.#check(entity, grant.delete)
  }

  canReorder(entity: Resource): boolean {
    return this.#check(entity, grant.reorder)
  }

  canMove(entity: Resource): boolean {
    return this.#check(entity, grant.move)
  }

  canPublish(entity: Resource): boolean {
    return this.#check(entity, grant.publish)
  }

  canArchive(entity: Resource): boolean {
    return this.#check(entity, grant.archive)
  }

  canUpload(entity: Resource): boolean {
    return this.#check(entity, grant.upload)
  }

  canExplore(entity: Resource): boolean {
    return this.#check(entity, grant.explore)
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

export async function createPolicy(
  role: Role,
  index: EntryIndex,
  graph: Graph
): Promise<Policy> {
  const policy = new WriteablePolicy(index.inheritPermissions.bind(index))
  await role.permissions(policy, graph)
  return Policy.from(policy)
}
