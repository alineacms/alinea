import type {Config} from '#/core/Config.js'
import {entryUrl} from '#/core/util/EntryFilenames.js'
import {assert} from '#/core/util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import type {Source} from '#/core/source/Source.js'
import {Leaf, ReadonlyTree, WriteableTree} from '#/core/source/Tree.js'
import {
  and,
  asc,
  count,
  eq,
  gt,
  inArray,
  isNull,
  ne,
  or,
  sql,
  table,
  type Database
} from 'rado'
import * as column from 'rado/universal/columns'
import {EntryIndexTable, entryIndexRow} from '../entry/Schema.js'
import {parseSourceEntry} from './EntryParser.js'

const sourceBatchSize = 250
const sqliteBatchSize = 500

const SyncFiles = table('alinea_sync_files', {
  filePath: column.text().primaryKey(),
  fileHash: column.text().notNull()
})

function syncEntryColumns() {
  return {
    versionId: column.text().primaryKey(),
    id: column.text().notNull(),
    locale: column.text().$type<string | null>(),
    versionStatus: column.text().notNull(),
    status: column.text().notNull(),
    type: column.text().notNull(),
    title: column.text().notNull(),
    workspace: column.text().notNull(),
    root: column.text().notNull(),
    sourceRoot: column.text().$type<string | null>(),
    parentId: column.text().$type<string | null>(),
    parents: column.text().notNull(),
    level: column.integer().notNull(),
    index: column.text().notNull(),
    ordinal: column.integer().notNull(),
    path: column.text().notNull(),
    filePath: column.text().notNull(),
    fileHash: column.text().notNull(),
    parentDir: column.text().notNull(),
    childrenDir: column.text().notNull(),
    url: column.text().notNull(),
    active: column.boolean().notNull(),
    main: column.boolean().notNull(),
    visible: column.boolean().notNull(),
    seeded: column.text().$type<string | null>(),
    rowHash: column.text().notNull(),
    childrenSha: column.text().$type<string | null>(),
    searchableText: column.text().notNull(),
    data: column.text().notNull()
  }
}

const SyncEntries = table('alinea_sync_entries', syncEntryColumns())
const SyncWork = table('alinea_sync_work', syncEntryColumns())

const SyncMainPaths = table('alinea_sync_main_paths', {
  id: column.text().notNull(),
  locale: column.text().$type<string | null>(),
  path: column.text().notNull()
})

const SyncUrls = table('alinea_sync_urls', {
  id: column.text().notNull(),
  locale: column.text().$type<string | null>(),
  url: column.text().notNull()
})

const SyncHashes = table('alinea_sync_level_hashes', {
  id: column.text().primaryKey(),
  childrenSha: column.text().notNull()
})

const SyncRehash = table('alinea_sync_rehash', {
  id: column.text().primaryKey()
})

interface FileRow {
  filePath: string
  fileHash: string
}

interface MainPathRow {
  id: string
  locale: string | null
  path: string
}

interface UrlRow {
  id: string
  locale: string | null
  url: string
}

interface HashRow {
  id: string
  childrenSha: string
}

interface WorkMainRow {
  versionId: string
  id: string
  locale: string | null
  type: string
  versionStatus: string
  workspace: string
  root: string
  path: string
  parents: string
  data: string
}

interface VersionRow {
  id: string
  versionId: string
  rowHash: string
}

interface ChildRow {
  id: string
  parentId: string | null
  childrenSha: string | null
}

function* chunks<T>(
  items: ReadonlyArray<T>,
  size: number
): Generator<Array<T>> {
  for (let offset = 0; offset < items.length; offset += size)
    yield items.slice(offset, offset + size)
}

function syncEntryRow(entry: ReturnType<typeof parseSourceEntry>) {
  const row = entryIndexRow(entry)
  return {
    ...row,
    parents: JSON.stringify(row.parents),
    data: JSON.stringify(row.data)
  }
}

function parentPathKey(id: string, locale: string | null): string {
  return JSON.stringify([id, locale])
}

function parseParents(value: string): Array<string> {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed) || parsed.some(id => typeof id !== 'string'))
    throw new Error('Invalid generated entry parents')
  return parsed
}

function parseData(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value)
  assert(isRecord(parsed), 'Invalid stored entry data')
  return parsed
}

async function temporaryTables(db: Database): Promise<void> {
  await db.run(sql`
    drop table if exists alinea_sync_files;
    drop table if exists alinea_sync_entries;
    drop table if exists alinea_sync_changed_paths;
    drop table if exists alinea_sync_affected;
    drop table if exists alinea_sync_work;
    drop table if exists alinea_sync_nodes;
    drop table if exists alinea_sync_parents;
    drop table if exists alinea_sync_languages;
    drop table if exists alinea_sync_effective;
    drop table if exists alinea_sync_main_paths;
    drop table if exists alinea_sync_urls;
    drop table if exists alinea_sync_rehash;
    drop table if exists alinea_sync_level_hashes;
  `)
}

async function createTemporaryTables(db: Database): Promise<void> {
  await temporaryTables(db)
  await db.run(sql`
    create temp table alinea_sync_files (
      filePath text primary key,
      fileHash text not null
    );
    create temp table alinea_sync_entries as
      select * from alinea_entry_index where false;
    create temp table alinea_sync_changed_paths (filePath text primary key);
    create temp table alinea_sync_affected (id text primary key);
    create temp table alinea_sync_work as
      select * from alinea_entry_index where false;
    create temp table alinea_sync_nodes (
      id text primary key,
      parentId text,
      parentDir text not null,
      childrenDir text not null
    );
    create temp table alinea_sync_parents (id text primary key, parents text not null);
    create temp table alinea_sync_languages (
      id text not null,
      locale text,
      parentId text,
      activeStatus text not null,
      ownStatus text,
      mainStatus text not null
    );
    create temp table alinea_sync_effective (
      id text not null,
      locale text,
      effectiveStatus text
    );
    create temp table alinea_sync_main_paths (
      id text not null,
      locale text,
      path text not null
    );
    create temp table alinea_sync_urls (
      id text not null,
      locale text,
      url text not null
    );
    create temp table alinea_sync_rehash (id text primary key);
    create temp table alinea_sync_level_hashes (
      id text primary key,
      childrenSha text not null
    );
    create index alinea_sync_entries_file_path
      on alinea_sync_entries(filePath);
    create index alinea_sync_work_id_locale
      on alinea_sync_work(id, locale);
    create index alinea_sync_work_version_id
      on alinea_sync_work(versionId);
    create index alinea_sync_nodes_children_dir
      on alinea_sync_nodes(childrenDir);
    create index alinea_sync_nodes_parent_id
      on alinea_sync_nodes(parentId);
    create index alinea_sync_languages_id_locale
      on alinea_sync_languages(id, locale);
    create index alinea_sync_languages_parent_locale
      on alinea_sync_languages(parentId, locale);
    create index alinea_sync_effective_id_locale
      on alinea_sync_effective(id, locale);
    create index alinea_sync_main_paths_id_locale
      on alinea_sync_main_paths(id, locale);
    create index alinea_sync_urls_id_locale
      on alinea_sync_urls(id, locale);
  `)
}

async function stageSourceFiles(
  db: Database,
  tree: ReadonlyTree
): Promise<void> {
  let rows: Array<FileRow> = []
  for (const [filePath, node] of tree) {
    if (!(node instanceof Leaf)) continue
    rows.push({filePath, fileHash: node.sha})
    if (rows.length < sqliteBatchSize) continue
    await db.insert(SyncFiles).values(rows)
    rows = []
  }
  if (rows.length) await db.insert(SyncFiles).values(rows)
}

async function stageChangedEntries(
  db: Database,
  config: Config,
  source: Source
): Promise<void> {
  for (;;) {
    const files = await db
      .select({
        filePath: SyncFiles.filePath,
        fileHash: SyncFiles.fileHash
      })
      .from(SyncFiles)
      .leftJoin(
        EntryIndexTable,
        eq(SyncFiles.filePath, EntryIndexTable.filePath)
      )
      .leftJoin(SyncEntries, eq(SyncFiles.filePath, SyncEntries.filePath))
      .where(
        and(
          isNull(SyncEntries.filePath),
          or(
            isNull(EntryIndexTable.filePath),
            ne(SyncFiles.fileHash, EntryIndexTable.fileHash)
          )
        )
      )
      .orderBy(asc(SyncFiles.filePath))
      .limit(sourceBatchSize)
    if (!files.length) return
    const pathsByHash = new Map<string, Array<string>>()
    for (const file of files as Array<FileRow>) {
      const paths = pathsByHash.get(file.fileHash) ?? []
      paths.push(file.filePath)
      pathsByHash.set(file.fileHash, paths)
    }
    const rows = Array<ReturnType<typeof syncEntryRow>>()
    const found = new Set<string>()
    for await (const [fileHash, blob] of source.getBlobs([
      ...pathsByHash.keys()
    ])) {
      const paths = pathsByHash.get(fileHash)
      if (!paths) continue
      found.add(fileHash)
      for (const filePath of paths)
        rows.push(
          syncEntryRow(parseSourceEntry(config, filePath, fileHash, blob))
        )
    }
    for (const fileHash of pathsByHash.keys())
      assert(found.has(fileHash), `Source did not return blob ${fileHash}`)
    await db.insert(SyncEntries).values(rows)
  }
}

async function stageInitialEntries(
  db: Database,
  config: Config,
  source: Source,
  tree: ReadonlyTree
): Promise<void> {
  let files = Array<FileRow>()
  async function flush(): Promise<void> {
    if (!files.length) return
    const pathsByHash = new Map<string, Array<string>>()
    for (const file of files) {
      const paths = pathsByHash.get(file.fileHash) ?? []
      paths.push(file.filePath)
      pathsByHash.set(file.fileHash, paths)
    }
    const rows = Array<ReturnType<typeof syncEntryRow>>()
    const found = new Set<string>()
    for await (const [fileHash, blob] of source.getBlobs([
      ...pathsByHash.keys()
    ])) {
      const paths = pathsByHash.get(fileHash)
      if (!paths) continue
      found.add(fileHash)
      for (const filePath of paths)
        rows.push(
          syncEntryRow(parseSourceEntry(config, filePath, fileHash, blob))
        )
    }
    for (const fileHash of pathsByHash.keys())
      assert(found.has(fileHash), `Source did not return blob ${fileHash}`)
    await db.insert(SyncWork).values(rows)
    files = []
  }
  for (const [filePath, node] of tree) {
    if (!(node instanceof Leaf)) continue
    files.push({filePath, fileHash: node.sha})
    if (files.length >= sourceBatchSize) await flush()
  }
  await flush()
}

async function identifyAffectedEntries(db: Database): Promise<void> {
  await db.run(sql`
    insert into alinea_sync_changed_paths(filePath)
      select source.filePath
      from alinea_sync_files source
      left join alinea_entry_index entry on entry.filePath = source.filePath
      where entry.filePath is null or entry.fileHash <> source.fileHash
    union
      select entry.filePath
      from alinea_entry_index entry
      left join alinea_sync_files source on source.filePath = entry.filePath
      where source.filePath is null;

    insert or ignore into alinea_sync_affected(id)
      select distinct entry.id
      from alinea_entry_index entry
      join alinea_sync_changed_paths changed on changed.filePath = entry.filePath;
    insert or ignore into alinea_sync_affected(id)
      select distinct id from alinea_sync_entries;
    insert or ignore into alinea_sync_affected(id)
      select distinct entry.id
      from alinea_entry_index entry
      join alinea_sync_entries changed
        on entry.filePath like changed.childrenDir || '/%';

    with recursive descendants(id) as (
      select id from alinea_sync_affected
      union
      select entry.id
      from alinea_entry_index entry
      join descendants on entry.parentId = descendants.id
    )
    insert or ignore into alinea_sync_affected(id)
      select id from descendants;
  `)
}

async function prepareWorkingRows(db: Database): Promise<void> {
  await db.run(sql`
    insert into alinea_sync_work
      select * from alinea_entry_index
      where id in (select id from alinea_sync_affected);
    delete from alinea_sync_work
      where filePath in (select filePath from alinea_sync_changed_paths);
    insert into alinea_sync_work select * from alinea_sync_entries;

    insert into alinea_sync_rehash(id)
      select id from alinea_sync_affected;
    insert or ignore into alinea_sync_rehash(id)
      select parentId from alinea_entry_index
      where id in (select id from alinea_sync_affected) and parentId is not null;
  `)
}

async function prepareInitialRows(db: Database): Promise<void> {
  await db.run(sql`
    insert into alinea_sync_affected(id) select distinct id from alinea_sync_work;
    insert into alinea_sync_rehash(id) select distinct id from alinea_sync_work;
  `)
}

async function deriveEntries(db: Database): Promise<void> {
  await db.run(sql`
    insert or replace into alinea_sync_nodes(id, parentId, parentDir, childrenDir)
      select id, null, min(parentDir), min(childrenDir)
      from alinea_entry_index
      where id not in (select id from alinea_sync_affected)
      group by id;
    insert or replace into alinea_sync_nodes(id, parentId, parentDir, childrenDir)
      select id, null, min(parentDir), min(childrenDir)
      from alinea_sync_work
      group by id;
    update alinea_sync_nodes as child
      set parentId = (
        select parent.id from alinea_sync_nodes parent
        where parent.childrenDir = child.parentDir limit 1
      );

    insert into alinea_sync_parents(id, parents)
      with recursive hierarchy(id, parents) as (
        select id, json_array() from alinea_sync_nodes where parentId is null
        union all
        select child.id, json_insert(parent.parents, '$[#]', parent.id)
        from alinea_sync_nodes child
        join hierarchy parent on child.parentId = parent.id
      )
      select id, parents from hierarchy;
    update alinea_sync_work as work
      set
        parentId = nodes.parentId,
        parents = coalesce(ancestry.parents, '[]')
      from alinea_sync_nodes nodes
      left join alinea_sync_parents ancestry on ancestry.id = nodes.id
      where nodes.id = work.id;

    insert into alinea_sync_languages(
      id, locale, parentId, activeStatus, ownStatus, mainStatus
    )
      with physical as (
        select id, locale, versionStatus
        from alinea_entry_index
        where id not in (select id from alinea_sync_affected)
        union all
        select id, locale, versionStatus from alinea_sync_work
      )
      select
        physical.id,
        physical.locale,
        nodes.parentId,
        case
          when max(physical.versionStatus = 'draft') then 'draft'
          when max(physical.versionStatus = 'published') then 'published'
          else 'archived'
        end,
        case
          when max(physical.versionStatus = 'archived') then 'archived'
          when max(physical.versionStatus = 'draft')
            and not max(physical.versionStatus = 'published') then 'draft'
          else null
        end,
        case
          when max(physical.versionStatus = 'published') then 'published'
          when max(physical.versionStatus = 'archived') then 'archived'
          else 'draft'
        end
      from physical
      join alinea_sync_nodes nodes on nodes.id = physical.id
      group by physical.id, physical.locale;

    insert into alinea_sync_effective(id, locale, effectiveStatus)
      with recursive effective(id, locale, effectiveStatus) as (
        select language.id, language.locale, language.ownStatus
        from alinea_sync_languages language
        where language.parentId is null or not exists (
          select 1 from alinea_sync_languages parent
          where parent.id = language.parentId and parent.locale is language.locale
        )
        union all
        select child.id, child.locale,
          coalesce(parent.effectiveStatus, child.ownStatus)
        from alinea_sync_languages child
        join effective parent
          on parent.id = child.parentId and parent.locale is child.locale
      )
      select id, locale, effectiveStatus from effective;

    update alinea_sync_work as work
      set
        status = coalesce(effective.effectiveStatus, work.versionStatus),
        active = work.versionStatus = language.activeStatus,
        main = work.versionStatus = case
          when effective.effectiveStatus is not null then language.activeStatus
          else language.mainStatus
        end,
        visible = case
          when effective.effectiveStatus is null then true
          else work.versionStatus = language.activeStatus
        end
      from alinea_sync_languages language
      left join alinea_sync_effective effective
        on effective.id = language.id and effective.locale is language.locale
      where language.id = work.id and language.locale is work.locale;

    insert or ignore into alinea_sync_rehash(id)
      select parentId from alinea_sync_work where parentId is not null;
  `)
}

async function deriveUrls(db: Database, config: Config): Promise<void> {
  await db.run(sql`
    insert into alinea_sync_main_paths(id, locale, path)
      select id, locale, path from alinea_entry_index
      where id not in (select id from alinea_sync_affected) and main;
    insert into alinea_sync_main_paths(id, locale, path)
      select id, locale, path from alinea_sync_work where main;
  `)
  let after: string | undefined
  for (;;) {
    const rows = await db
      .select({
        versionId: SyncWork.versionId,
        id: SyncWork.id,
        locale: SyncWork.locale,
        type: SyncWork.type,
        versionStatus: SyncWork.versionStatus,
        workspace: SyncWork.workspace,
        root: SyncWork.root,
        path: SyncWork.path,
        parents: SyncWork.parents,
        data: SyncWork.data
      })
      .from(SyncWork)
      .where(
        and(
          eq(SyncWork.main, true),
          after ? gt(SyncWork.versionId, after) : undefined
        )
      )
      .orderBy(asc(SyncWork.versionId))
      .limit(sqliteBatchSize)
    if (!rows.length) break
    after = rows.at(-1)?.versionId
    const parentIds = Array.from(
      new Set(rows.flatMap(row => parseParents(row.parents)))
    )
    const paths = parentIds.length
      ? await db
          .select({
            id: SyncMainPaths.id,
            locale: SyncMainPaths.locale,
            path: SyncMainPaths.path
          })
          .from(SyncMainPaths)
          .where(inArray(SyncMainPaths.id, parentIds))
      : []
    const pathById = new Map<string, string>()
    for (const path of paths as Array<MainPathRow>)
      pathById.set(parentPathKey(path.id, path.locale), path.path)
    const urls = Array<UrlRow>()
    for (const row of rows as Array<WorkMainRow>) {
      const type = config.schema[row.type]
      assert(type, `Entry ${row.id} has an unknown type: ${row.type}`)
      const parentPaths = parseParents(row.parents).map(id => {
        const path = pathById.get(parentPathKey(id, row.locale))
        assert(path, `Missing parent path for ${id}`)
        return path
      })
      urls.push({
        id: row.id,
        locale: row.locale,
        url: entryUrl(type, {
          config,
          data: parseData(row.data),
          status: row.versionStatus as 'draft' | 'published' | 'archived',
          path: row.path,
          parentPaths,
          locale: row.locale,
          workspace: row.workspace,
          root: row.root
        })
      })
    }
    await db.insert(SyncUrls).values(urls)
  }
  await db.run(sql`
    update alinea_sync_work as work
      set url = (
        select url from alinea_sync_urls urls
        where urls.id = work.id and urls.locale is work.locale
      )
      where exists (
        select 1 from alinea_sync_urls urls
        where urls.id = work.id and urls.locale is work.locale
      );
  `)
}

async function deriveInitialUrls(db: Database): Promise<void> {
  await db.run(sql`
    update alinea_sync_work as work
      set url = (
        select main.url from alinea_sync_work main
        where main.id = work.id
          and main.locale is work.locale
          and main.main
      );
  `)
}

async function directoryHash(
  versions: ReadonlyArray<VersionRow>,
  children: ReadonlyArray<ChildRow>
): Promise<string> {
  const tree = new WriteableTree()
  for (const version of versions) tree.add(version.versionId, version.rowHash)
  const included = new Set<string>()
  for (const child of children) {
    if (included.has(child.id)) continue
    assert(child.childrenSha, `Missing child hash for ${child.id}`)
    included.add(child.id)
    tree.add(child.id, new ReadonlyTree({sha: child.childrenSha, entries: []}))
  }
  return (await tree.compile()).sha
}

async function rehash(db: Database): Promise<void> {
  await db.run(sql`
    with recursive ancestors(id) as (
      select entry.parentId
      from alinea_entry_index entry
      join alinea_sync_rehash rehash on rehash.id = entry.id
      where entry.parentId is not null
      union
      select entry.parentId
      from alinea_entry_index entry
      join ancestors on ancestors.id = entry.id
      where entry.parentId is not null
    )
    insert or ignore into alinea_sync_rehash(id)
      select id from ancestors;
  `)
  const levels = (await db.all(sql`
    select distinct entry.level as level
    from alinea_entry_index entry
    join alinea_sync_rehash rehash on rehash.id = entry.id
    order by entry.level desc
  `)) as Array<{level: number}>
  for (const {level} of levels) {
    let after: string | undefined
    for (;;) {
      const identities = await db
        .select({id: EntryIndexTable.id})
        .from(EntryIndexTable)
        .innerJoin(SyncRehash, eq(EntryIndexTable.id, SyncRehash.id))
        .where(
          and(
            eq(EntryIndexTable.level, level),
            after ? gt(EntryIndexTable.id, after) : undefined
          )
        )
        .groupBy(EntryIndexTable.id)
        .orderBy(asc(EntryIndexTable.id))
        .limit(sqliteBatchSize)
      if (!identities.length) break
      after = identities.at(-1)?.id
      const ids = identities.map(identity => identity.id)
      const versions = (await db
        .select({
          id: EntryIndexTable.id,
          versionId: EntryIndexTable.versionId,
          rowHash: EntryIndexTable.rowHash
        })
        .from(EntryIndexTable)
        .where(inArray(EntryIndexTable.id, ids))) as Array<VersionRow>
      const children = (await db
        .select({
          id: EntryIndexTable.id,
          parentId: EntryIndexTable.parentId,
          childrenSha: EntryIndexTable.childrenSha
        })
        .from(EntryIndexTable)
        .where(inArray(EntryIndexTable.parentId, ids))) as Array<ChildRow>
      const versionsById = new Map<string, Array<VersionRow>>()
      for (const version of versions) {
        const nested = versionsById.get(version.id) ?? []
        nested.push(version)
        versionsById.set(version.id, nested)
      }
      const childrenByParent = new Map<string, Array<ChildRow>>()
      for (const child of children) {
        if (!child.parentId) continue
        const nested = childrenByParent.get(child.parentId) ?? []
        nested.push(child)
        childrenByParent.set(child.parentId, nested)
      }
      const hashes = await Promise.all(
        ids.map(async id => ({
          id,
          childrenSha: await directoryHash(
            versionsById.get(id) ?? [],
            childrenByParent.get(id) ?? []
          )
        }))
      )
      await db.run(sql`delete from alinea_sync_level_hashes`)
      await db.insert(SyncHashes).values(hashes as Array<HashRow>)
      await db.run(sql`
        update alinea_entry_index as entry
          set childrenSha = (
            select childrenSha from alinea_sync_level_hashes hash
            where hash.id = entry.id
          )
          where exists (
            select 1 from alinea_sync_level_hashes hash where hash.id = entry.id
          );
      `)
    }
  }
}

/**
 * Synchronize one source tree with SQLite. Every large collection lives in a
 * temporary SQLite table; JavaScript holds only bounded source/blob batches.
 */
export async function syncSourceTree(
  db: Database,
  config: Config,
  source: Source,
  tree: ReadonlyTree,
  fromRevision: string
): Promise<void> {
  await db.transaction(
    async tx => {
      try {
        const state = (await tx.all(sql`
          select revision from alinea_database_state where id = 1
        `)) as Array<{revision: string}>
        if (state[0]?.revision !== fromRevision)
          throw new Error('Database revision mismatch')
        await createTemporaryTables(tx)
        const initial =
          (await tx.select(count()).from(EntryIndexTable).get()) === 0
        if (initial) {
          await stageInitialEntries(tx, config, source, tree)
          await prepareInitialRows(tx)
        } else {
          await stageSourceFiles(tx, tree)
          await stageChangedEntries(tx, config, source)
          await identifyAffectedEntries(tx)
          await prepareWorkingRows(tx)
        }
        await deriveEntries(tx)
        if (initial) await deriveInitialUrls(tx)
        else await deriveUrls(tx, config)
        await tx.run(sql`
          delete from alinea_entry_index
          where id in (select id from alinea_sync_affected);
          insert into alinea_entry_index select * from alinea_sync_work;
        `)
        await rehash(tx)
        await tx.run(sql`
          update alinea_database_state set revision = ${tree.sha} where id = 1
        `)
      } finally {
        await temporaryTables(tx)
      }
    },
    {async: true}
  )
}
