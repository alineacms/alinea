import type {Graph} from './Graph.js'
import {
  type HasRoot,
  type HasType,
  type HasWorkspace,
  hasRoot
} from './Internal.js'
import type {EntryIndex} from './db/EntryIndex.js'

export type Tag = HasWorkspace | HasRoot | HasType | string

type AttachedTags = (tag: Tag) => Set<Tag> | undefined

function tagsByIndex(entryIndex: EntryIndex) {
  return (tag: Tag): Set<Tag> | undefined => {
    if (typeof tag === 'string') {
      const node = entryIndex.byId.get(tag)
      if (!node) return undefined
      // Todo: cache this result on the entry node or locally
      const result = new Set<Tag>()
      for (const tag of node.tags) result.add(tag)
      for (const parentId of entryIndex.parentsOf(tag)) result.add(parentId)
      return result
    }
    if (hasRoot(tag)) {
      const workspace = entryIndex.scope.workspaceOf(tag)
      return new Set([workspace])
    }
  }
}

export class Policy {
  protected root = Permission.None
  protected acl = new Map<Tag, number>()

  constructor(protected getTags: AttachedTags) {}

  static from(policy: Policy): Policy {
    const result = new Policy(policy.getTags)
    result.root = policy.root
    result.acl = new Map(policy.acl)
    return result
  }

  concat(that: Policy): Policy {
    const result = new Policy(this.getTags)
    result.root = this.root | that.root
    const acl = new Map(this.acl)
    for (const [tag, permissions] of that.acl)
      acl.set(tag, permissions | acl.get(tag)!)
    result.acl = acl
    return result
  }

  #permissionsOf(tag: Tag): number {
    let result = this.root

    const attached = this.getTags(tag)
    if (attached)
      for (const attachedTag of attached) result |= this.acl.get(attachedTag)!

    result |= this.acl.get(tag)!

    return result
  }

  #check(entity: Tag, permission: Permission): boolean {
    return Boolean(this.#permissionsOf(entity) & permission)
  }

  canRead(entity: Tag): boolean {
    return this.#check(entity, Permission.Read)
  }

  canCreate(entity: Tag): boolean {
    return this.#check(entity, Permission.Create)
  }

  canUpdate(entity: Tag): boolean {
    return this.#check(entity, Permission.Update)
  }

  canDelete(entity: Tag): boolean {
    return this.#check(entity, Permission.Delete)
  }

  canReorder(entity: Tag): boolean {
    return this.#check(entity, Permission.Reorder)
  }

  canMove(entity: Tag): boolean {
    return this.#check(entity, Permission.Move)
  }

  canPublish(entity: Tag): boolean {
    return this.#check(entity, Permission.Publish)
  }

  canArchive(entity: Tag): boolean {
    return this.#check(entity, Permission.Archive)
  }

  canUpload(entity: Tag): boolean {
    return this.#check(entity, Permission.Upload)
  }

  canExplore(entity: Tag): boolean {
    return this.#check(entity, Permission.Explore)
  }

  canAll(entity: Tag): boolean {
    return this.#check(entity, Permission.All)
  }
}

export class WriteablePolicy extends Policy {
  applyAll(permissions: Permissions): this {
    const [grant, revoke] = packPermissions(permissions)
    this.root |= grant
    if (revoke) {
      for (const [tag, existingPermissions] of this.acl)
        this.acl.set(tag, existingPermissions & ~revoke)
    }
    return this
  }

  #apply(tag: Tag, permissions: Permissions): this {
    const [grant, revoke] = packPermissions(permissions)
    if (revoke) {
      for (const [otherTag, existingPermissions] of this.acl) {
        if (otherTag === tag) continue
        const attached = this.getTags(otherTag)
        if (attached?.has(tag))
          this.acl.set(otherTag, existingPermissions & ~revoke)
      }
    }
    this.acl.set(tag, grant)
    return this
  }

  applyWorkspace(workspace: HasWorkspace, permissions: Permissions): this {
    return this.#apply(workspace, permissions)
  }

  applyRoot(
    root: HasRoot,
    permissions: Permissions | Record<string, Permissions>
  ): this {
    return this.#apply(root, permissions)
  }

  applyType(type: HasType, permissions: Permissions): this {
    return this.#apply(type, permissions)
  }

  applyEntry(entryId: string, permissions: Permissions): this {
    return this.#apply(entryId, permissions)
  }
}

enum Permission {
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
  All = Create |
    Read |
    Update |
    Delete |
    Reorder |
    Move |
    Publish |
    Archive |
    Upload |
    Explore
}

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

const mapped = [
  ['create', Permission.Create],
  ['read', Permission.Read],
  ['update', Permission.Update],
  ['delete', Permission.Delete],
  ['reorder', Permission.Reorder],
  ['move', Permission.Move],
  ['publish', Permission.Publish],
  ['archive', Permission.Archive],
  ['upload', Permission.Upload],
  ['explore', Permission.Explore]
] as const

function packPermissions(
  permissions: Permissions
): [grant: number, revoke: number] {
  let grant = Permission.None
  let revoke = Permission.None
  for (const [name, value] of mapped) {
    if (permissions[name] === undefined) continue
    if (permissions[name]) {
      grant |= value
    } else {
      revoke |= value
    }
  }
  return [grant, revoke] as const
}

export type Location = {
  workspace: string
  root: string
  parentId?: string
  lanaguage?: string
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
  const getTags = tagsByIndex(index)
  const policy = new WriteablePolicy(getTags)
  await role.permissions(policy, graph)
  return Policy.from(policy)
}
