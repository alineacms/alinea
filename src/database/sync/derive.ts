import type {Config} from '#/core/Config.js'
import {assert} from '#/core/util/Assert.js'
import {entryUrl} from '#/core/util/EntryFilenames.js'
import {
  and,
  asc,
  count,
  eq,
  inArray,
  max,
  min,
  ne,
  or,
  sql,
  when,
  type Database
} from 'rado'
import {
  storedEntryData,
  type EntryIndexTarget,
  type IndexedEntry
} from '../entry/Schema.js'
import {
  chunks,
  sqliteBatchSize,
  SyncAffected,
  SyncStatus,
  SyncValues,
  type DirectoryRow,
  type HierarchyRow,
  type MainRow,
  type ParentPathRow,
  type StatusRow,
  type EntrySyncTarget,
  type SyncQueries
} from './queries.js'

export async function deriveHierarchy(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
  queries: SyncQueries
): Promise<boolean> {
  let changed = false
  let afterVersionId = ''
  while (true) {
    const rows = (await queries.hierarchy.all({
      afterVersionId
    })) as Array<HierarchyRow>
    if (!rows.length) return changed
    afterVersionId = rows.at(-1)!.versionId
    const prefixesByVersionId = new Map<string, Array<string>>()
    const needed = new Set<string>()
    for (const row of rows) {
      const segments = row.parentDir.split('/')
      const prefixes = segments.map((_, index) =>
        segments.slice(0, index + 1).join('/')
      )
      prefixesByVersionId.set(row.versionId, prefixes)
      for (const prefix of prefixes) needed.add(prefix)
    }
    const directories = Array<DirectoryRow>()
    for (const paths of chunks(Array.from(needed), sqliteBatchSize))
      directories.push(
        ...((await db
          .select({
            id: EntryIndexTable.id,
            childrenDir: EntryIndexTable.childrenDir
          })
          .from(EntryIndexTable)
          .where(inArray(EntryIndexTable.childrenDir, paths))
          .groupBy(EntryIndexTable.childrenDir)) as Array<DirectoryRow>)
      )
    const idByDirectory = new Map<string, string>()
    for (const directory of directories)
      idByDirectory.set(directory.childrenDir, directory.id)
    const hierarchy = rows.flatMap(row => {
      const parents = (prefixesByVersionId.get(row.versionId) ?? []).flatMap(
        path => {
          const id = idByDirectory.get(path)
          return id ? [id] : []
        }
      )
      const parentId = parents.at(-1) ?? null
      const unchanged =
        row.parentId === parentId &&
        row.parents.length === parents.length &&
        row.parents.every((id, index) => id === parents[index])
      return unchanged
        ? []
        : [{key: row.versionId, value: JSON.stringify({parentId, parents})}]
    })
    if (!hierarchy.length) continue
    changed = true
    await queries.clearValues.run()
    await db.insert(SyncValues).values(hierarchy)
    await queries.updateHierarchy.run()
  }
}

export async function expandAffected(
  db: Database,
  EntryIndexTable: EntryIndexTarget
): Promise<void> {
  await db.run(sql`
    with recursive descendants(id) as (
      select id from alinea_sync_cascade
      union
      select entry.id from ${EntryIndexTable} entry
      join descendants on entry.parentId = descendants.id
    )
    insert or ignore into alinea_sync_affected(id) select id from descendants;
  `)
}

export async function materializeAffected(
  db: Database,
  target: EntrySyncTarget,
  queries: SyncQueries,
  materialized: Set<string>
): Promise<void> {
  if (!target.changes) return
  const affected = (await queries.changedIds.all()) as Array<{id: string}>
  const candidates = affected
    .map(row => row.id)
    .filter(id => !materialized.has(id))
  for (const ids of chunks(candidates, sqliteBatchSize)) {
    const resident = await db
      .select({id: target.changes.id})
      .from(target.changes)
      .where(inArray(target.changes.id, ids))
      .groupBy(target.changes.id)
    for (const row of resident) materialized.add(row.id)
  }
  const missing = candidates.filter(id => !materialized.has(id))
  for (const ids of chunks(missing, sqliteBatchSize)) {
    await db
      .update(target.entries)
      .set({versionId: target.entries.versionId})
      .where(inArray(target.entries.id, ids))
  }
  for (const id of missing) materialized.add(id)
}

export async function deriveStatus(
  db: Database,
  queries: SyncQueries
): Promise<void> {
  const levels = (await queries.levels.all()) as Array<{level: number}>
  for (const {level} of levels) {
    // One fetch per level: OFFSET pagination rescans from the start on
    // every page, which is quadratic in affected rows.
    const rows = (await queries.statuses.all({level})) as Array<StatusRow>
    if (!rows.length) continue
    const parentKeys = Array.from(
      new Set(
        rows.flatMap(row =>
          row.parentId ? [statusKey(row.parentId, row.locale)] : []
        )
      )
    )
    const parentByKey = new Map<
      string,
      {key: string; effectiveStatus: string}
    >()
    for (const page of chunks(parentKeys, sqliteBatchSize)) {
      const parents = (await db
        .select()
        .from(SyncStatus)
        .where(inArray(SyncStatus.key, page))) as Array<{
        key: string
        effectiveStatus: string
      }>
      for (const parent of parents) parentByKey.set(parent.key, parent)
    }
    for (const page of chunks(rows, sqliteBatchSize))
      await db.insert(SyncStatus).values(
        page.map(row => {
          const parent = row.parentId
            ? parentByKey.get(statusKey(row.parentId, row.locale))
            : undefined
          return {
            key: statusKey(row.id, row.locale),
            effectiveStatus: parent?.effectiveStatus ?? row.ownStatus,
            activeStatus: row.activeStatus,
            mainStatus: row.mainStatus
          }
        })
      )
  }
  await queries.updateStatus.run()
}

function statusKey(id: string, locale: string | null): string {
  return JSON.stringify([id, locale])
}

function parentPathKey(id: string, locale: string | null): string {
  return `${id}\0${locale ?? ''}`
}

export async function deriveUrls(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
  config: Config,
  queries: SyncQueries
): Promise<void> {
  let afterVersionId = ''
  while (true) {
    const rows = (await queries.mainEntries.all({
      afterVersionId
    })) as Array<MainRow>
    if (!rows.length) break
    afterVersionId = rows.at(-1)!.versionId
    const parentIds = Array.from(new Set(rows.flatMap(row => row.parents)))
    const parentPaths = parentIds.length
      ? ((await db
          .select({
            id: EntryIndexTable.id,
            locale: EntryIndexTable.locale,
            path: EntryIndexTable.path
          })
          .from(EntryIndexTable)
          .where(
            and(
              eq(EntryIndexTable.main, true),
              inArray(EntryIndexTable.id, parentIds)
            )
          )) as Array<ParentPathRow>)
      : []
    const pathByParent = new Map<string, string>()
    for (const parent of parentPaths)
      pathByParent.set(parentPathKey(parent.id, parent.locale), parent.path)
    const urls = Array<{key: string; value: string}>()
    for (const row of rows) {
      const type = config.schema[row.type]
      assert(type, `Entry ${row.id} has an unknown type: ${row.type}`)
      const paths = row.parents.map(id => {
        const path = pathByParent.get(parentPathKey(id, row.locale))
        assert(path !== undefined, `Missing parent path for ${id}`)
        return path
      })
      urls.push({
        key: row.versionId,
        value: entryUrl(type, {
          config,
          data: storedEntryData(row.data, row.path),
          status: row.versionStatus as IndexedEntry['versionStatus'],
          path: row.path,
          parentPaths: paths,
          locale: row.locale,
          workspace: row.workspace,
          root: row.root
        })
      })
    }
    await queries.clearValues.run()
    await db.insert(SyncValues).values(urls)
    await queries.updateUrls.run()
  }
}

/** Validate authored relationships that SQLite column constraints cannot express. */
export async function validateEntries(
  db: Database,
  entries: EntryIndexTarget
): Promise<void> {
  const minParent = min(sql<string>`coalesce(${entries.parentId}, '')`)
  const maxParent = max(sql<string>`coalesce(${entries.parentId}, '')`)
  const node = await db
    .select({
      id: entries.id,
      minType: min(entries.type),
      maxType: max(entries.type),
      minIndex: min(entries.index),
      maxIndex: max(entries.index),
      minRoot: min(entries.root),
      maxRoot: max(entries.root),
      minWorkspace: min(entries.workspace),
      maxWorkspace: max(entries.workspace),
      minParent,
      maxParent
    })
    .from(entries)
    .innerJoin(SyncAffected, eq(entries.id, SyncAffected.id))
    .groupBy(entries.id)
    .having(
      or(
        ne(min(entries.type), max(entries.type)),
        ne(min(entries.index), max(entries.index)),
        ne(min(entries.root), max(entries.root)),
        ne(min(entries.workspace), max(entries.workspace)),
        ne(minParent, maxParent)
      )
    )
    .get()
  if (node) {
    const versions = await db
      .select({
        type: entries.type,
        index: entries.index,
        root: entries.root,
        workspace: entries.workspace,
        locale: entries.locale,
        filePath: entries.filePath,
        parentId: entries.parentId
      })
      .from(entries)
      .where(eq(entries.id, node.id))
      .orderBy(asc(entries.filePath))
    type Version = (typeof versions)[number]
    const differences = Array<{
      label: string
      value: (version: Version) => string | null
    }>()
    function addDifference(
      label: string,
      value: (version: Version) => string | null
    ) {
      if (new Set(versions.map(value)).size > 1)
        differences.push({label, value})
    }
    addDifference('_type', version => version.type)
    addDifference('_index', version => version.index)
    addDifference('root', version => version.root)
    addDifference('workspace', version => version.workspace)
    addDifference('parent', version => version.parentId)
    assert(
      false,
      `Mismatched authored entry versions for ${node.id}. All translations and statuses of an entry must use the same type, index, root, workspace, and logical parent.\n${versions
        .map(
          version =>
            `${version.filePath}: ${differences
              .map(
                difference =>
                  `${difference.label}=${JSON.stringify(difference.value(version))}`
              )
              .join(', ')}`
        )
        .join('\n')}`
    )
  }

  const language = await db
    .select({
      id: entries.id,
      locale: entries.locale,
      minPath: min(entries.path),
      maxPath: max(entries.path),
      minParentDir: min(entries.parentDir),
      maxParentDir: max(entries.parentDir),
      minChildrenDir: min(entries.childrenDir),
      maxChildrenDir: max(entries.childrenDir)
    })
    .from(entries)
    .innerJoin(SyncAffected, eq(entries.id, SyncAffected.id))
    .groupBy(entries.id, entries.locale)
    .having(
      or(
        ne(min(entries.path), max(entries.path)),
        ne(min(entries.parentDir), max(entries.parentDir)),
        ne(min(entries.childrenDir), max(entries.childrenDir))
      )
    )
    .get()
  assert(
    !language,
    `Mismatched authored language versions for ${language?.id} (${language?.locale ?? 'unlocalized'})`
  )

  const activeCount = count(
    when([eq(entries.active, true), sql.value(1)], null)
  )
  const mainCount = count(when([eq(entries.main, true), sql.value(1)], null))
  const status = await db
    .select({
      id: entries.id,
      locale: entries.locale,
      activeCount,
      mainCount
    })
    .from(entries)
    .innerJoin(SyncAffected, eq(entries.id, SyncAffected.id))
    .groupBy(entries.id, entries.locale)
    .having(or(ne(activeCount, 1), ne(mainCount, 1)))
    .get()
  assert(
    !status,
    `Invalid derived status for ${status?.id} (${status?.locale ?? 'unlocalized'})`
  )

  const hierarchy = await db
    .select({id: entries.id, filePath: entries.filePath})
    .from(entries)
    .innerJoin(SyncAffected, eq(entries.id, SyncAffected.id))
    .where(
      sql<boolean>`exists (
        select 1 from json_each(${entries.parents}) parent
        where parent.value = ${entries.id}
      )`
    )
    .get()
  assert(!hierarchy, `Invalid entry hierarchy: ${hierarchy?.filePath}`)
}

export async function copyInitialUrls(queries: SyncQueries): Promise<void> {
  await queries.copyInitialUrls.run()
}

/** Prepared, serialized source synchronization for one database connection. */
