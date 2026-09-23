import type {Tree} from '#/core/source/Tree.js'
import {
  and,
  count,
  eq,
  gt,
  lt,
  max,
  min,
  ne,
  or,
  sql,
  when,
  Builder,
  type Database,
  type HasSql,
  type Sql
} from 'rado'
import {entryDataText} from '../entry/EntryData.js'
import {
  EntryIndexColumns,
  type entryIndexRow,
  type EntryIndexTarget
} from '../entry/EntryTable.js'
import type {EntrySyncTarget} from './EntrySyncer.js'

export const sqliteBatchSize = 5000

const builder = new Builder()
const ids = sql.placeholder<string>('ids')
const versionIds = sql.placeholder<string>('versionIds')
const filePaths = sql.placeholder<string>('filePaths')
const dirs = sql.placeholder<string>('dirs')
const dir = sql.placeholder<string>('dir')
const from = sql.placeholder<string>('from')
const to = sql.placeholder<string>('to')
const revision = sql.placeholder<string>('revision')
const treeSnapshot = sql.placeholder<string | null>('tree')

/**
 * Match a column against a JSON array parameter, so one prepared statement
 * takes any number of values and SQLite still searches the column's index.
 */
function inJson(column: HasSql, values: Sql<string>): Sql<boolean> {
  return sql<boolean>`${column} in (select value from json_each(${values}))`
}

/** The columns of an entry version that deriving reads and writes. */
function versionFields(entries: EntryIndexTarget) {
  return {
    versionId: entries.versionId,
    id: entries.id,
    locale: entries.locale,
    versionStatus: entries.versionStatus,
    type: entries.type,
    index: entries.index,
    workspace: entries.workspace,
    root: entries.root,
    path: entries.path,
    filePath: entries.filePath,
    level: entries.level,
    parentDir: entries.parentDir,
    childrenDir: entries.childrenDir,
    childrenSha: entries.childrenSha,
    parentId: entries.parentId,
    parents: entries.parents,
    status: entries.status,
    active: entries.active,
    main: entries.main,
    visible: entries.visible,
    url: entries.url
  }
}

/** Reuse the same INSERT while streaming entries through bounded batches. */
function insertEntryQuery(entries: EntryIndexTarget, jsonb: boolean) {
  type Row = ReturnType<typeof entryIndexRow>
  const values = Object.fromEntries(
    Object.keys(EntryIndexColumns).map(name => [name, sql.placeholder(name)])
  ) as {[Key in keyof Row]: Sql<NonNullable<Row[Key]>>}
  if (jsonb) values.data = sql<string>`jsonb(${values.data})`
  return builder.insert(entries).values(values)
}

/**
 * Named parameters bypass column encoders, so bind SQLite values explicitly for
 * the placeholders of {@link insertEntryQuery}.
 */
export function insertEntryValues(row: ReturnType<typeof entryIndexRow>) {
  return {
    ...row,
    parents: JSON.stringify(row.parents),
    active: Number(row.active),
    main: Number(row.main),
    visible: Number(row.visible)
  }
}

export function prepareSyncQueries(
  db: Database,
  target: EntrySyncTarget,
  /** Store entry data as JSONB, on a SQLite that reads it. */
  jsonb: boolean
) {
  const {entries, state} = target
  const activeCount = count(
    when([eq(entries.active, true), sql.value(1)], null)
  )
  const mainCount = count(when([eq(entries.main, true), sql.value(1)], null))
  const parentKey = sql<string>`coalesce(${entries.parentId}, '')`
  const statements = {
    revision: builder
      .select({revision: state.revision})
      .from(state)
      .where(eq(state.id, 1))
      .$first()
      .prepare(undefined, db),
    tree: builder
      .select({tree: state.tree})
      .from(state)
      .where(eq(state.id, 1))
      .$first()
      .prepare(undefined, db),
    setRevision: builder
      .update(state)
      .set({revision, tree: sql<Tree>`${treeSnapshot}`})
      .where(eq(state.id, 1))
      .prepare(undefined, db),
    entryCount: builder
      .select({value: count()})
      .from(entries)
      .where(sql.value(true))
      .$first()
      .prepare(undefined, db),
    insertEntry: insertEntryQuery(entries, jsonb).prepare(undefined, db),
    /** Versions stored at these file paths or under these version ids. */
    storedFiles: builder
      .select({
        id: entries.id,
        filePath: entries.filePath,
        childrenDir: entries.childrenDir,
        childrenSha: entries.childrenSha
      })
      .from(entries)
      .where(
        or(
          inJson(entries.filePath, filePaths),
          inJson(entries.versionId, versionIds)
        )
      )
      .prepare(undefined, db),
    deleteFiles: builder
      .delete(entries)
      .where(
        or(
          inJson(entries.filePath, filePaths),
          inJson(entries.versionId, versionIds)
        )
      )
      .prepare(undefined, db),
    directories: builder
      .select({
        id: entries.id,
        childrenDir: entries.childrenDir,
        childrenSha: entries.childrenSha
      })
      .from(entries)
      .where(inJson(entries.childrenDir, dirs))
      .prepare(undefined, db),
    updateChildrenSha: builder
      .update(entries)
      .set({childrenSha: sql<string>`${sql.placeholder('sha')}`})
      .where(eq(entries.childrenDir, dir))
      .prepare(undefined, db),
    /** Every version of these entries. */
    versionsOf: builder
      .select(versionFields(entries))
      .from(entries)
      .where(inJson(entries.id, ids))
      .prepare(undefined, db),
    /** Every version stored below one directory. */
    versionsBelow: builder
      .select(versionFields(entries))
      .from(entries)
      .where(and(gt(entries.filePath, from), lt(entries.filePath, to)))
      .prepare(undefined, db),
    /** The entry owning each directory: children stored there have it as parent. */
    owners: builder
      .select({childrenDir: entries.childrenDir, id: entries.id})
      .from(entries)
      .where(inJson(entries.childrenDir, dirs))
      .groupBy(entries.childrenDir)
      .prepare(undefined, db),
    statusesOf: builder
      .select({id: entries.id, locale: entries.locale, status: entries.status})
      .from(entries)
      .where(inJson(entries.id, ids))
      .prepare(undefined, db),
    dataOf: builder
      .select({versionId: entries.versionId, data: entryDataText(entries)})
      .from(entries)
      .where(inJson(entries.versionId, versionIds))
      .prepare(undefined, db),
    updateVersion: builder
      .update(entries)
      .set({
        parentId: sql<string | null>`${sql.placeholder('parentId')}`,
        parents: sql<Array<string>>`${sql.placeholder('parents')}`,
        status: sql<never>`${sql.placeholder('status')}`,
        active: sql<boolean>`${sql.placeholder('active')}`,
        main: sql<boolean>`${sql.placeholder('main')}`,
        visible: sql<boolean>`${sql.placeholder('visible')}`,
        url: sql<string>`${sql.placeholder('url')}`
      })
      .where(eq(entries.versionId, sql.placeholder<string>('versionId')))
      .prepare(undefined, db),
    /** An entry whose versions disagree on what all of them must share. */
    mismatchedEntry: builder
      .select({id: entries.id})
      .from(entries)
      .where(inJson(entries.id, ids))
      .groupBy(entries.id)
      .having(
        or(
          ne(min(entries.type), max(entries.type)),
          ne(min(entries.index), max(entries.index)),
          ne(min(entries.root), max(entries.root)),
          ne(min(entries.workspace), max(entries.workspace)),
          ne(min(parentKey), max(parentKey))
        )
      )
      .$first()
      .prepare(undefined, db),
    /** A language whose versions disagree on their location. */
    mismatchedLanguage: builder
      .select({id: entries.id, locale: entries.locale})
      .from(entries)
      .where(inJson(entries.id, ids))
      .groupBy(entries.id, entries.locale)
      .having(
        or(
          ne(min(entries.path), max(entries.path)),
          ne(min(entries.parentDir), max(entries.parentDir)),
          ne(min(entries.childrenDir), max(entries.childrenDir))
        )
      )
      .$first()
      .prepare(undefined, db),
    /** A language without exactly one active and one main version. */
    invalidStatus: builder
      .select({id: entries.id, locale: entries.locale})
      .from(entries)
      .where(inJson(entries.id, ids))
      .groupBy(entries.id, entries.locale)
      .having(or(ne(activeCount, 1), ne(mainCount, 1)))
      .$first()
      .prepare(undefined, db),
    /** A version listed among its own parents. */
    cyclicVersion: builder
      .select({filePath: entries.filePath})
      .from(entries)
      .where(
        and(
          inJson(entries.id, ids),
          sql<boolean>`exists (
          select 1 from json_each(${entries.parents}) parent
          where parent.value = ${entries.id}
        )`
        )
      )
      .$first()
      .prepare(undefined, db)
  }
  return {
    ...statements,
    free() {
      for (const statement of Object.values(statements)) statement.free()
    }
  }
}

export type SyncQueries = ReturnType<typeof prepareSyncQueries>
