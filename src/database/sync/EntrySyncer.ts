import type {Config} from '#/core/Config.js'
import type {Source} from '#/core/source/Source.js'
import {Leaf, ReadonlyTree} from '#/core/source/Tree.js'
import {assert} from '#/core/util/Assert.js'
import {entryUrl} from '#/core/util/EntryFilenames.js'
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  max,
  min,
  not,
  or,
  sql,
  table,
  type Database,
  when
} from 'rado'
import * as column from 'rado/universal/columns'
import {
  EntryIndexTable,
  entryIndexRow,
  type IndexedEntry
} from '../entry/Schema.js'
import {parseSourceEntry} from './EntryParser.js'

const changeBatchSize = 750
const sqliteBatchSize = 500

const DatabaseState = table('alinea_database_state', {
  id: column.integer().primaryKey(),
  revision: column.text().notNull()
})

const SyncAffected = table('alinea_sync_affected', {
  id: column.text().primaryKey()
})

const SyncValues = table('alinea_sync_values', {
  key: column.text().primaryKey(),
  value: column.text().notNull()
})

const SyncStatus = table('alinea_sync_status', {
  key: column.text().primaryKey(),
  effectiveStatus: column.text().$type<string | null>(),
  activeStatus: column.text().notNull(),
  mainStatus: column.text().notNull()
})

interface FileRow {
  filePath: string
  fileHash: string
}

interface StoredFileRow extends FileRow {
  id: string
  versionId: string
  childrenDir: string
  childrenSha: string | null
}

interface MainRow {
  versionId: string
  id: string
  locale: string | null
  type: string
  versionStatus: string
  workspace: string
  root: string
  path: string
  parents: Array<string>
  data: Record<string, unknown>
}

interface ParentPathRow {
  id: string
  locale: string | null
  path: string
}

interface HierarchyRow {
  id: string
  parentDir: string
}

interface DirectoryRow {
  id: string
  childrenDir: string
}

interface StatusRow {
  id: string
  locale: string | null
  parentId: string | null
  activeStatus: string
  ownStatus: string | null
  mainStatus: string
}

function* chunks<T>(
  items: ReadonlyArray<T>,
  size: number
): Generator<Array<T>> {
  for (let offset = 0; offset < items.length; offset += size)
    yield items.slice(offset, offset + size)
}

function prepareSyncQueries(db: Database) {
  const afterFilePath = sql.placeholder<string>('afterFilePath')
  const afterEntryId = sql.placeholder<string>('afterEntryId')
  const afterVersionId = sql.placeholder<string>('afterVersionId')
  const level = sql.placeholder<number>('level')
  const offset = sql.placeholder<number>('offset')
  const revision = sql.placeholder<string>('revision')
  const isDraft = max(eq(EntryIndexTable.versionStatus, 'draft'))
  const isPublished = max(eq(EntryIndexTable.versionStatus, 'published'))
  const isArchived = max(eq(EntryIndexTable.versionStatus, 'archived'))

  const statements = {
    revision: db
      .select({revision: DatabaseState.revision})
      .from(DatabaseState)
      .where(eq(DatabaseState.id, 1))
      .$first()
      .prepare(),
    entryCount: db.$count(EntryIndexTable).prepare(),
    setRevision: db
      .update(DatabaseState)
      .set({revision})
      .where(eq(DatabaseState.id, 1))
      .prepare<{revision: string}>(),
    storedFiles: db
      .select({
        id: EntryIndexTable.id,
        filePath: EntryIndexTable.filePath,
        fileHash: EntryIndexTable.fileHash,
        versionId: EntryIndexTable.versionId,
        childrenDir: EntryIndexTable.childrenDir,
        childrenSha: EntryIndexTable.childrenSha
      })
      .from(EntryIndexTable)
      .where(gt(EntryIndexTable.filePath, afterFilePath))
      .orderBy(asc(EntryIndexTable.filePath))
      .limit(sqliteBatchSize)
      .prepare<{afterFilePath: string}>(),
    hierarchy: db
      .select({id: EntryIndexTable.id, parentDir: EntryIndexTable.parentDir})
      .from(EntryIndexTable)
      .innerJoin(SyncAffected, eq(EntryIndexTable.id, SyncAffected.id))
      .where(gt(EntryIndexTable.id, afterEntryId))
      .groupBy(EntryIndexTable.id)
      .orderBy(asc(EntryIndexTable.id))
      .limit(sqliteBatchSize)
      .prepare<{afterEntryId: string}>(),
    levels: db
      .select({level: EntryIndexTable.level})
      .from(EntryIndexTable)
      .innerJoin(SyncAffected, eq(EntryIndexTable.id, SyncAffected.id))
      .groupBy(EntryIndexTable.level)
      .orderBy(asc(EntryIndexTable.level))
      .prepare(),
    statuses: db
      .select({
        id: EntryIndexTable.id,
        locale: EntryIndexTable.locale,
        parentId: min(EntryIndexTable.parentId),
        activeStatus: when(
          [isDraft, 'draft'],
          [isPublished, 'published'],
          'archived'
        ),
        ownStatus: when(
          [isArchived, 'archived'],
          [and(isDraft, not(isPublished)), 'draft'],
          null
        ),
        mainStatus: when(
          [isPublished, 'published'],
          [isArchived, 'archived'],
          'draft'
        )
      })
      .from(EntryIndexTable)
      .innerJoin(SyncAffected, eq(EntryIndexTable.id, SyncAffected.id))
      .where(eq(EntryIndexTable.level, level))
      .groupBy(EntryIndexTable.id, EntryIndexTable.locale)
      .orderBy(asc(EntryIndexTable.id), asc(EntryIndexTable.locale))
      .limit(sqliteBatchSize)
      .offset(offset)
      .prepare<{level: number; offset: number}>(),
    mainEntries: db
      .select({
        versionId: EntryIndexTable.versionId,
        id: EntryIndexTable.id,
        locale: EntryIndexTable.locale,
        type: EntryIndexTable.type,
        versionStatus: EntryIndexTable.versionStatus,
        workspace: EntryIndexTable.workspace,
        root: EntryIndexTable.root,
        path: EntryIndexTable.path,
        parents: EntryIndexTable.parents,
        data: EntryIndexTable.data
      })
      .from(EntryIndexTable)
      .innerJoin(SyncAffected, eq(EntryIndexTable.id, SyncAffected.id))
      .where(
        and(
          eq(EntryIndexTable.main, true),
          gt(EntryIndexTable.versionId, afterVersionId)
        )
      )
      .orderBy(asc(EntryIndexTable.versionId))
      .limit(sqliteBatchSize)
      .prepare<{afterVersionId: string}>(),
    changedIds: db
      .select({id: SyncAffected.id})
      .from(SyncAffected)
      .orderBy(asc(SyncAffected.id))
      .prepare()
  }
  return {
    ...statements,
    free() {
      for (const statement of Object.values(statements)) statement.free()
    }
  }
}

type SyncQueries = ReturnType<typeof prepareSyncQueries>

async function createTemporaryTables(db: Database): Promise<void> {
  await db.run(sql`
    drop table if exists alinea_sync_affected;
    drop table if exists alinea_sync_values;
    drop table if exists alinea_sync_status;
    create temp table alinea_sync_affected (id text primary key);
    create temp table alinea_sync_values (
      key text primary key,
      value text not null
    );
    create temp table alinea_sync_status (
      key text primary key,
      effectiveStatus text,
      activeStatus text not null,
      mainStatus text not null
    );
  `)
}

async function dropTemporaryTables(db: Database): Promise<void> {
  await db.run(sql`
    drop table if exists alinea_sync_affected;
    drop table if exists alinea_sync_values;
    drop table if exists alinea_sync_status;
  `)
}

async function clearTemporaryTables(db: Database): Promise<void> {
  await db.delete(SyncAffected)
  await db.delete(SyncValues)
  await db.delete(SyncStatus)
}

async function markAffected(
  db: Database,
  filePaths: ReadonlyArray<string>,
  versionIds: ReadonlyArray<string> = []
): Promise<void> {
  if (!filePaths.length && !versionIds.length) return
  const existing = await db
    .select({id: EntryIndexTable.id})
    .from(EntryIndexTable)
    .where(
      or(
        filePaths.length
          ? inArray(EntryIndexTable.filePath, Array.from(filePaths))
          : undefined,
        versionIds.length
          ? inArray(EntryIndexTable.versionId, Array.from(versionIds))
          : undefined
      )
    )
  await addAffected(
    db,
    existing.map(row => row.id)
  )
}

async function addAffected(db: Database, ids: Iterable<string>): Promise<void> {
  const unique = Array.from(new Set(ids))
  if (!unique.length) return
  const existing = await db
    .select({id: SyncAffected.id})
    .from(SyncAffected)
    .where(inArray(SyncAffected.id, unique))
  const present = new Set(existing.map(row => row.id))
  const missing = unique.filter(id => !present.has(id))
  if (missing.length)
    await db.insert(SyncAffected).values(missing.map(id => ({id})))
}

async function deleteFiles(
  db: Database,
  filePaths: ReadonlyArray<string>
): Promise<void> {
  if (!filePaths.length) return
  await markAffected(db, filePaths)
  await db
    .delete(EntryIndexTable)
    .where(inArray(EntryIndexTable.filePath, Array.from(filePaths)))
}

async function replaceFiles(
  db: Database,
  config: Config,
  source: Source,
  tree: ReadonlyTree,
  files: ReadonlyArray<FileRow>
): Promise<void> {
  if (!files.length) return
  const pathsByHash = new Map<string, Array<string>>()
  for (const file of files) {
    const paths = pathsByHash.get(file.fileHash) ?? []
    paths.push(file.filePath)
    pathsByHash.set(file.fileHash, paths)
  }
  const entries = Array<IndexedEntry>()
  const found = new Set<string>()
  for await (const [fileHash, blob] of source.getBlobs([
    ...pathsByHash.keys()
  ])) {
    const paths = pathsByHash.get(fileHash)
    if (!paths) continue
    found.add(fileHash)
    for (const filePath of paths)
      entries.push(parseSourceEntry(config, filePath, fileHash, blob))
  }
  for (const fileHash of pathsByHash.keys())
    assert(found.has(fileHash), `Source did not return blob ${fileHash}`)
  const rows = entries.map(entry => ({
    ...entryIndexRow(entry),
    childrenSha: sourceDirectorySha(tree, entry.childrenDir)
  }))
  const filePaths = rows.map(row => row.filePath)
  const versionIds = rows.map(row => row.versionId)
  await markAffected(db, filePaths, versionIds)
  await db
    .delete(EntryIndexTable)
    .where(
      or(
        inArray(EntryIndexTable.filePath, filePaths),
        inArray(EntryIndexTable.versionId, versionIds)
      )
    )
  await db.insert(EntryIndexTable).values(rows)
  await addAffected(
    db,
    rows.map(row => row.id)
  )
}

async function insertInitialSource(
  db: Database,
  config: Config,
  source: Source,
  tree: ReadonlyTree
): Promise<void> {
  const pathsByHash = new Map<string, Array<string>>()
  for (const [filePath, node] of tree) {
    if (!(node instanceof Leaf)) continue
    const paths = pathsByHash.get(node.sha) ?? []
    paths.push(filePath)
    pathsByHash.set(node.sha, paths)
  }
  const found = new Set<string>()
  let rows = Array<ReturnType<typeof entryIndexRow>>()
  async function flush(): Promise<void> {
    if (!rows.length) return
    await db.insert(EntryIndexTable).values(rows)
    rows = []
  }
  for await (const [fileHash, blob] of source.getBlobs([
    ...pathsByHash.keys()
  ])) {
    const paths = pathsByHash.get(fileHash)
    if (!paths) continue
    found.add(fileHash)
    for (const filePath of paths) {
      const entry = parseSourceEntry(config, filePath, fileHash, blob)
      rows.push({
        ...entryIndexRow(entry),
        childrenSha: sourceDirectorySha(tree, entry.childrenDir)
      })
      if (rows.length >= changeBatchSize) await flush()
    }
  }
  await flush()
  for (const fileHash of pathsByHash.keys())
    assert(found.has(fileHash), `Source did not return blob ${fileHash}`)
  await db.run(sql`
    insert into alinea_sync_affected(id)
      select distinct id from alinea_entry_index;
  `)
}

async function* storedFiles(
  queries: SyncQueries
): AsyncGenerator<StoredFileRow> {
  let afterFilePath = ''
  for (;;) {
    const rows = (await queries.storedFiles.all({
      afterFilePath
    })) as Array<StoredFileRow>
    if (!rows.length) return
    for (const row of rows) yield row
    afterFilePath = rows.at(-1)!.filePath
  }
}

async function mergeSource(
  db: Database,
  config: Config,
  source: Source,
  tree: ReadonlyTree,
  queries: SyncQueries
): Promise<void> {
  const stored = storedFiles(queries)[Symbol.asyncIterator]()
  function* sourceFiles(): Generator<[string, Leaf]> {
    for (const [filePath, node] of tree)
      if (node instanceof Leaf) yield [filePath, node]
  }
  const incoming = sourceFiles()
  let currentStored = await stored.next()
  let currentIncoming = incoming.next()
  let removed = Array<string>()
  let changed = Array<FileRow>()
  let directoryHashes = Array<{key: string; value: string}>()
  let directoryIds = Array<string>()

  async function flush(): Promise<void> {
    await deleteFiles(db, removed)
    await replaceFiles(db, config, source, tree, changed)
    if (directoryHashes.length) {
      await addAffected(db, directoryIds)
      await db.delete(SyncValues)
      await db.insert(SyncValues).values(directoryHashes)
      await db.run(sql`
        update alinea_entry_index as entry set childrenSha = (
          select value from alinea_sync_values update_value
          where update_value.key = entry.versionId
        ) where exists (
          select 1 from alinea_sync_values update_value
          where update_value.key = entry.versionId
        );
      `)
    }
    removed = []
    changed = []
    directoryHashes = []
    directoryIds = []
  }

  while (!currentStored.done || !currentIncoming.done) {
    const storedRow = currentStored.done ? undefined : currentStored.value
    const incomingRow = currentIncoming.done
      ? undefined
      : {
          filePath: currentIncoming.value[0],
          fileHash: currentIncoming.value[1].sha
        }
    if (
      !incomingRow ||
      (storedRow && storedRow.filePath < incomingRow.filePath)
    ) {
      removed.push(storedRow!.filePath)
      currentStored = await stored.next()
    } else if (!storedRow || incomingRow.filePath < storedRow.filePath) {
      changed.push(incomingRow)
      currentIncoming = incoming.next()
    } else {
      if (storedRow.fileHash !== incomingRow.fileHash) {
        changed.push(incomingRow)
      } else {
        const childrenSha = sourceDirectorySha(tree, storedRow.childrenDir)
        if (childrenSha !== storedRow.childrenSha) {
          directoryHashes.push({key: storedRow.versionId, value: childrenSha})
          directoryIds.push(storedRow.id)
        }
      }
      currentStored = await stored.next()
      currentIncoming = incoming.next()
    }
    if (
      removed.length + changed.length + directoryHashes.length >=
      changeBatchSize
    )
      await flush()
  }
  await flush()
}

function sourceDirectorySha(tree: ReadonlyTree, path: string): string {
  const node = tree.get(path)
  if (!node) return ReadonlyTree.EMPTY.sha
  assert(!(node instanceof Leaf), `Entry children path is a file: ${path}`)
  return node.sha
}

async function deriveHierarchy(
  db: Database,
  queries: SyncQueries
): Promise<void> {
  let afterEntryId = ''
  for (;;) {
    const rows = (await queries.hierarchy.all({
      afterEntryId
    })) as Array<HierarchyRow>
    if (!rows.length) return
    afterEntryId = rows.at(-1)!.id
    const prefixesById = new Map<string, Array<string>>()
    const needed = new Set<string>()
    for (const row of rows) {
      const segments = row.parentDir.split('/')
      const prefixes = segments.map((_, index) =>
        segments.slice(0, index + 1).join('/')
      )
      prefixesById.set(row.id, prefixes)
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
          .groupBy(EntryIndexTable.id)) as Array<DirectoryRow>)
      )
    const idByDirectory = new Map<string, string>()
    for (const directory of directories)
      idByDirectory.set(directory.childrenDir, directory.id)
    const hierarchy = rows.map(row => {
      const parents = (prefixesById.get(row.id) ?? []).flatMap(path => {
        const id = idByDirectory.get(path)
        return id ? [id] : []
      })
      return {
        key: row.id,
        value: JSON.stringify({parentId: parents.at(-1) ?? null, parents})
      }
    })
    await db.delete(SyncValues)
    await db.insert(SyncValues).values(hierarchy)
    await db.run(sql`
      update alinea_entry_index as entry set
        parentId = json_extract(update_value.value, '$.parentId'),
        parents = json_extract(update_value.value, '$.parents')
      from alinea_sync_values update_value
      where update_value.key = entry.id;
    `)
  }
}

async function expandAffected(db: Database): Promise<void> {
  await db.run(sql`
    with recursive descendants(id) as (
      select id from alinea_sync_affected
      union
      select entry.id from alinea_entry_index entry
      join descendants on entry.parentId = descendants.id
    )
    insert or ignore into alinea_sync_affected(id) select id from descendants;

  `)
}

async function deriveStatus(db: Database, queries: SyncQueries): Promise<void> {
  const levels = (await queries.levels.all()) as Array<{level: number}>
  for (const {level} of levels) {
    let offset = 0
    for (;;) {
      const rows = (await queries.statuses.all({
        level,
        offset
      })) as Array<StatusRow>
      if (!rows.length) break
      offset += rows.length
      const parentKeys = Array.from(
        new Set(
          rows.flatMap(row =>
            row.parentId ? [statusKey(row.parentId, row.locale)] : []
          )
        )
      )
      const parents = parentKeys.length
        ? await db
            .select()
            .from(SyncStatus)
            .where(inArray(SyncStatus.key, parentKeys))
        : []
      const parentByKey = new Map(parents.map(parent => [parent.key, parent]))
      await db.insert(SyncStatus).values(
        rows.map(row => {
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
  }
  await db.run(sql`
    update alinea_entry_index as entry set
      status = coalesce(sync_status.effectiveStatus, entry.versionStatus),
      active = entry.versionStatus = sync_status.activeStatus,
      main = entry.versionStatus = case
        when sync_status.effectiveStatus is not null then sync_status.activeStatus
        else sync_status.mainStatus
      end,
      visible = case
        when sync_status.effectiveStatus is null then true
        else entry.versionStatus = sync_status.activeStatus
      end
    from alinea_sync_status sync_status
    where sync_status.key = json_array(entry.id, entry.locale);
  `)
}

function statusKey(id: string, locale: string | null): string {
  return JSON.stringify([id, locale])
}

function parentPathKey(id: string, locale: string | null): string {
  return `${id}\0${locale ?? ''}`
}

async function deriveUrls(
  db: Database,
  config: Config,
  queries: SyncQueries
): Promise<void> {
  let afterVersionId = ''
  for (;;) {
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
          data: row.data,
          status: row.versionStatus as IndexedEntry['versionStatus'],
          path: row.path,
          parentPaths: paths,
          locale: row.locale,
          workspace: row.workspace,
          root: row.root
        })
      })
    }
    await db.delete(SyncValues)
    await db.insert(SyncValues).values(urls)
    await db.run(sql`
      update alinea_entry_index as entry set url = (
        select update_value.value
        from alinea_sync_values update_value
        join alinea_entry_index main on main.versionId = update_value.key
        where main.id = entry.id and main.locale is entry.locale
      ) where exists (
        select 1
        from alinea_sync_values update_value
        join alinea_entry_index main on main.versionId = update_value.key
        where main.id = entry.id and main.locale is entry.locale
      );
    `)
  }
}

async function copyInitialUrls(db: Database): Promise<void> {
  await db.run(sql`
    update alinea_entry_index as entry set url = (
      select main.url from alinea_entry_index main
      where main.id = entry.id
        and main.locale is entry.locale
        and main.main
    );
  `)
}

/** Prepared, serialized source synchronization for one database connection. */
export class EntrySyncer implements AsyncDisposable {
  #db: Database
  #config: Config
  #queries: Promise<SyncQueries>
  #queue: Promise<unknown> = Promise.resolve()
  #closed = false

  constructor(config: Config, db: Database) {
    this.#config = config
    this.#db = db
    this.#queries = this.#initialize()
  }

  async #initialize(): Promise<SyncQueries> {
    await createTemporaryTables(this.#db)
    return prepareSyncQueries(this.#db)
  }

  /** Stream a source/tree diff directly into the canonical SQLite table. */
  sync(
    source: Source,
    tree: ReadonlyTree,
    fromRevision: string
  ): Promise<Array<string>> {
    if (this.#closed) return Promise.reject(new Error('EntrySyncer is closed'))
    const task = this.#queue.then(() => this.#sync(source, tree, fromRevision))
    this.#queue = task.catch(() => {})
    return task
  }

  async #sync(
    source: Source,
    tree: ReadonlyTree,
    fromRevision: string
  ): Promise<Array<string>> {
    const queries = await this.#queries
    return this.#db.transaction(
      async tx => {
        await clearTemporaryTables(tx)
        const state = await queries.revision.get()
        if (state?.revision !== fromRevision)
          throw new Error('Database revision mismatch')
        const initial = (await queries.entryCount.get()) === 0
        if (initial) await insertInitialSource(tx, this.#config, source, tree)
        else await mergeSource(tx, this.#config, source, tree, queries)
        await expandAffected(tx)
        await deriveHierarchy(tx, queries)
        await expandAffected(tx)
        await deriveStatus(tx, queries)
        if (initial) await copyInitialUrls(tx)
        else await deriveUrls(tx, this.#config, queries)
        const changed = await queries.changedIds.all()
        await queries.setRevision.run({revision: tree.sha})
        return changed.map(row => row.id)
      },
      {async: true}
    )
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await this.#queue
    const queries = await this.#queries
    queries.free()
    await dropTemporaryTables(this.#db)
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }
}
