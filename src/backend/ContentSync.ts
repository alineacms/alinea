import type {
  ContentEntry,
  ContentState,
  ContentStateResponse,
  ContentVersion
} from '#/core/ContentSync.js'
import type {Entry} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import {
  Permission,
  type Permissions,
  type Policy,
  type Resource
} from '#/core/Role.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {Type} from '#/core/Type.js'
import {entries, fromEntries} from '#/core/util/Objects.js'
import type {LocalDB} from '#/core/db/LocalDB.js'

const encoder = new TextEncoder()

function permissionBits(permissions: Permissions): number {
  let result = Permission.None
  if (permissions.create) result |= Permission.Create
  if (permissions.read) result |= Permission.Read
  if (permissions.update) result |= Permission.Update
  if (permissions.delete) result |= Permission.Delete
  if (permissions.reorder) result |= Permission.Reorder
  if (permissions.move) result |= Permission.Move
  if (permissions.publish) result |= Permission.Publish
  if (permissions.archive) result |= Permission.Archive
  if (permissions.upload) result |= Permission.Upload
  if (permissions.explore) result |= Permission.Explore
  if (permissions.manageMembers) result |= Permission.ManageMembers
  return result
}

function effectivePermissions(
  policy: Policy,
  resource?: Resource
): Permissions {
  return {
    create: policy.canCreate(resource),
    read: policy.canRead(resource),
    update: policy.canUpdate(resource),
    delete: policy.canDelete(resource),
    reorder: policy.canReorder(resource),
    move: policy.canMove(resource),
    publish: policy.canPublish(resource),
    archive: policy.canArchive(resource),
    upload: policy.canUpload(resource),
    explore: policy.canExplore(resource),
    manageMembers: policy.canManageMembers(),
    all: policy.canAll(resource)
  }
}

async function contentHash(value: unknown): Promise<string> {
  return hashBlob(encoder.encode(JSON.stringify(value)))
}

async function projectVersion(
  db: LocalDB,
  policy: Policy,
  entry: Entry,
  readableIds: ReadonlySet<string>,
  parents: Array<string>
): Promise<ContentVersion> {
  const type = db.config.schema[entry.type]
  const data = {...entry.data}
  const fieldPermissions: Record<string, number> = {}
  if (type) {
    for (const [fieldName] of entries(Type.fields(type))) {
      const resource = {...entry, field: fieldName}
      const permissions = effectivePermissions(policy, resource)
      fieldPermissions[fieldName] = permissionBits(permissions)
      if (!permissions.read) delete data[fieldName]
    }
  }
  const parentId = parents.at(-1) ?? null
  const projected = {
    ...entry,
    data,
    title: typeof data.title === 'string' ? data.title : entry.type,
    searchableText: type ? Type.searchableText(type, data) : '',
    parentId,
    parents
  }
  const record = createRecord(projected, projected.status)
  const fileHash = await contentHash(record)
  const normalized = {...projected, fileHash, rowHash: fileHash}
  const references = type
    ? Type.references(type, data)
        .filter(reference => readableIds.has(reference.targetId))
        .map(reference => ({
          ...reference,
          sourceId: normalized.id,
          sourceFilePath: normalized.filePath,
          sourceType: normalized.type,
          sourceLocale: normalized.locale,
          sourceStatus: normalized.status,
          sourceActive: normalized.active,
          sourceMain: normalized.main
        }))
    : []
  return {
    entry: normalized,
    permissions: permissionBits(effectivePermissions(policy, entry)),
    fieldPermissions,
    references
  }
}

export async function createContentState(
  db: LocalDB,
  policy: Policy,
  configId: string
): Promise<ContentStateResponse> {
  const all = Array.from(db.index.filter({}))
  const readable = all.filter(entry => policy.canRead(entry))
  const readableIds = new Set(readable.map(entry => entry.id))
  const readableLocales = new Map<string, Set<string | null>>()
  const versionsById = new Map<string, Array<Entry>>()
  for (const entry of readable) {
    const locales = readableLocales.get(entry.id) ?? new Set<string | null>()
    locales.add(entry.locale)
    readableLocales.set(entry.id, locales)
    const versions = versionsById.get(entry.id) ?? []
    versions.push(entry)
    versionsById.set(entry.id, versions)
  }
  const stateEntries: Record<string, string> = {}
  const objects: Record<string, ContentEntry> = {}
  for (const [id, versions] of versionsById) {
    versions.sort((left, right) => left.filePath.localeCompare(right.filePath))
    const parents = versions[0].parents.filter(parentId => {
      const locales = readableLocales.get(parentId)
      return Boolean(
        locales && versions.every(version => locales.has(version.locale))
      )
    })
    const object: ContentEntry = {
      id,
      versions: await Promise.all(
        versions.map(entry =>
          projectVersion(db, policy, entry, readableIds, parents)
        )
      )
    }
    const hash = await contentHash(object)
    stateEntries[id] = hash
    objects[hash] = object
  }
  const policyData = policy.export()
  policyData.resources.sort(([left], [right]) => left.localeCompare(right))
  const stableEntries = fromEntries(
    entries(stateEntries).sort(([left], [right]) => left.localeCompare(right))
  )
  const revision = await contentHash({
    configId,
    policy: policyData,
    entries: stableEntries
  })
  return {
    state: {
      version: 1,
      revision,
      configId,
      policy: policyData,
      entries: stableEntries
    },
    objects
  }
}
