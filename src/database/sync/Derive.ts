import type {Config} from '#/core/Config.js'
import {chunks} from '#/core/util/Arrays.js'
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
import {storedEntryData, type EntryIndexTarget} from '../entry/EntryTable.js'
import {
  sqliteBatchSize,
  SyncAffected,
  SyncCascade,
  SyncStatus,
  writeValues,
  type SyncQueries,
  type SyncValueRow
} from './SyncQueries.js'

/**
 * Page through affected versions by keyset, staging the computed values of each
 * page and applying `update`. Resolves to whether anything was written.
 */
async function derivePages<Row extends {versionId: string}>(
  queries: SyncQueries,
  page: (afterVersionId: string) => Promise<Array<Row>>,
  compute: (rows: Array<Row>) => Promise<Array<SyncValueRow>>,
  update: SyncQueries['updateHierarchy' | 'updateUrls']
): Promise<boolean> {
  let changed = false
  let afterVersionId = ''
  while (true) {
    const rows = await page(afterVersionId)
    if (!rows.length) return changed
    afterVersionId = rows.at(-1)!.versionId
    const values = await compute(rows)
    if (!values.length) continue
    changed = true
    await writeValues(queries, values, update)
  }
}

export function deriveHierarchy(
  db: Database,
  entries: EntryIndexTarget,
  queries: SyncQueries
): Promise<boolean> {
  return derivePages(
    queries,
    async afterVersionId => queries.hierarchy.all({afterVersionId}),
    async rows => {
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
      const idByDirectory = new Map<string, string>()
      for (const paths of chunks(Array.from(needed), sqliteBatchSize)) {
        const directories = await db
          .select({
            id: entries.id,
            childrenDir: entries.childrenDir
          })
          .from(entries)
          .where(inArray(entries.childrenDir, paths))
          .groupBy(entries.childrenDir)
        for (const directory of directories)
          idByDirectory.set(directory.childrenDir, directory.id)
      }
      return rows.flatMap(row => {
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
    },
    queries.updateHierarchy
  )
}

export async function expandAffected(
  db: Database,
  entries: EntryIndexTarget
): Promise<void> {
  await db.run(sql`
    with recursive descendants(id) as (
      select id from ${SyncCascade}
      union
      select entry.id from ${entries} entry
      join descendants on entry.parentId = descendants.id
    )
    insert or ignore into ${SyncAffected}(id) select id from descendants;
  `)
}

export async function deriveStatus(
  db: Database,
  queries: SyncQueries
): Promise<void> {
  const levels = await queries.levels.all()
  for (const {level} of levels) {
    // One fetch per level: OFFSET pagination rescans from the start on
    // every page, which is quadratic in affected rows.
    const rows = await queries.statuses.all({level})
    if (!rows.length) continue
    const parentKeys = Array.from(
      new Set(
        rows.flatMap(row =>
          row.parentId ? [statusKey(row.parentId, row.locale)] : []
        )
      )
    )
    const parentByKey = new Map<string, string | null>()
    for (const page of chunks(parentKeys, sqliteBatchSize)) {
      const parents = await db
        .select()
        .from(SyncStatus)
        .where(inArray(SyncStatus.key, page))
      for (const parent of parents)
        parentByKey.set(parent.key, parent.effectiveStatus)
    }
    for (const row of rows) {
      const parentStatus = row.parentId
        ? parentByKey.get(statusKey(row.parentId, row.locale))
        : undefined
      await queries.insertStatus.run({
        key: statusKey(row.id, row.locale),
        effectiveStatus: parentStatus ?? row.ownStatus,
        activeStatus: row.activeStatus,
        mainStatus: row.mainStatus
      })
    }
  }
  await queries.updateStatus.run()
}

/** Must match the `json_array(id, locale)` key in SyncQueries' status update. */
function statusKey(id: string, locale: string | null): string {
  return JSON.stringify([id, locale])
}

export async function deriveUrls(
  db: Database,
  entries: EntryIndexTarget,
  config: Config,
  queries: SyncQueries
): Promise<void> {
  await derivePages(
    queries,
    async afterVersionId => queries.mainEntries.all({afterVersionId}),
    async rows => {
      const parentIds = Array.from(new Set(rows.flatMap(row => row.parents)))
      const parentPaths = parentIds.length
        ? await db
            .select({
              id: entries.id,
              locale: entries.locale,
              path: entries.path
            })
            .from(entries)
            .where(and(eq(entries.main, true), inArray(entries.id, parentIds)))
        : []
      const pathByParent = new Map<string, string>()
      for (const parent of parentPaths)
        pathByParent.set(statusKey(parent.id, parent.locale), parent.path)
      return rows.map(row => {
        const type = config.schema[row.type]
        assert(type, `Entry ${row.id} has an unknown type: ${row.type}`)
        const paths = row.parents.map(id => {
          const path = pathByParent.get(statusKey(id, row.locale))
          assert(path !== undefined, `Missing parent path for ${id}`)
          return path
        })
        return {
          key: row.versionId,
          value: entryUrl(type, {
            config,
            data: storedEntryData(row.data, row.path),
            status: row.versionStatus,
            path: row.path,
            parentPaths: paths,
            locale: row.locale,
            workspace: row.workspace,
            root: row.root
          })
        }
      })
    },
    queries.updateUrls
  )
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
