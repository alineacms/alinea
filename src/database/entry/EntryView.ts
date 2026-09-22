import {eq, sql, temporaryTable, type Database, type Table} from 'rado'
import * as column from 'rado/universal/columns'
import {DatabaseStateColumns} from '../DatabaseTables.js'
import {
  EntryIndexColumns,
  entryIndexTable,
  type EntryIndexTarget
} from './EntryTable.js'

const namePattern = /^[a-z][a-z0-9_]*$/i

const OverlayKeyColumns = {
  versionId: column.varchar(undefined, {length: 255}).primaryKey()
}

function objectName(name: string, suffix: string): string {
  if (!namePattern.test(name))
    throw new Error(
      `Invalid entry view name ${JSON.stringify(name)}: use letters, numbers and underscores`
    )
  return `alinea_${name}_${suffix}`
}

/** A named, copy-on-write entry view over another entry table or view. */
export class EntryView implements AsyncDisposable {
  readonly name: string
  readonly entries: EntryIndexTarget
  readonly changes: EntryIndexTarget
  readonly searchName: string
  readonly state: Table<typeof DatabaseStateColumns>
  readonly #db: Database
  readonly #entryChanges: EntryIndexTarget
  readonly #keys: Table<typeof OverlayKeyColumns>
  #closed = false

  private constructor(
    db: Database,
    name: string,
    entries: EntryIndexTarget,
    entryChanges: EntryIndexTarget,
    keys: Table<typeof OverlayKeyColumns>,
    state: Table<typeof DatabaseStateColumns>
  ) {
    this.#db = db
    this.name = name
    this.entries = entries
    this.changes = entryChanges
    this.searchName = objectName(name, 'search')
    this.#entryChanges = entryChanges
    this.#keys = keys
    this.state = state
  }

  static async create(
    db: Database,
    name: string,
    parent: EntryIndexTarget,
    revision: string
  ): Promise<EntryView> {
    const viewName = objectName(name, 'entries')
    const changesName = objectName(name, 'entry_changes')
    const keysName = objectName(name, 'entry_keys')
    const stateName = objectName(name, 'state')
    const insertTrigger = objectName(name, 'entry_insert')
    const updateTrigger = objectName(name, 'entry_update')
    const deleteTrigger = objectName(name, 'entry_delete')
    const entries = entryIndexTable(viewName)
    const entryChanges = entryIndexTable(changesName, true)
    const keys = temporaryTable(keysName, OverlayKeyColumns)
    const state = temporaryTable(stateName, DatabaseStateColumns)
    const columns = Object.keys(EntryIndexColumns)
    const columnList = sql.join(columns.map(sql.identifier), sql`, `)
    const newValues = sql.join(
      columns.map(name => sql`new.${sql.identifier(name)}`),
      sql`, `
    )
    const result = new EntryView(db, name, entries, entryChanges, keys, state)
    try {
      await db.create(entryChanges, keys, state)
      await db.insert(state).values({id: 1, revision, tree: null})
      await db.run(sql`create temp view ${sql.identifier(viewName)} as
        select parent.* from ${parent} parent
        where not exists (
          select 1 from ${keys} changed
          where changed.versionId = parent.versionId
        )
        union all
        select changes.* from ${entryChanges} changes`)
      await db.run(sql`create temp trigger ${sql.identifier(insertTrigger)}
        instead of insert on ${sql.identifier(viewName)} begin
          insert or ignore into ${keys}(versionId) values (new.versionId);
          insert or replace into ${entryChanges}(${columnList})
            values (${newValues});
        end`)
      await db.run(sql`create temp trigger ${sql.identifier(updateTrigger)}
        instead of update on ${sql.identifier(viewName)} begin
          insert or ignore into ${keys}(versionId) values (old.versionId);
          insert or ignore into ${keys}(versionId) values (new.versionId);
          delete from ${entryChanges} where versionId = old.versionId;
          insert or replace into ${entryChanges}(${columnList})
            values (${newValues});
        end`)
      await db.run(sql`create temp trigger ${sql.identifier(deleteTrigger)}
        instead of delete on ${sql.identifier(viewName)} begin
          insert or ignore into ${keys}(versionId) values (old.versionId);
          delete from ${entryChanges} where versionId = old.versionId;
        end`)
      return result
    } catch (error) {
      await result.close()
      throw error
    }
  }

  async getRevision(): Promise<string> {
    const revision = await this.#db
      .select(this.state.revision)
      .from(this.state)
      .where(eq(this.state.id, 1))
      .get()
    if (revision == null)
      throw new Error(`Missing revision for view ${this.name}`)
    return revision
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    const insertTrigger = objectName(this.name, 'entry_insert')
    const updateTrigger = objectName(this.name, 'entry_update')
    const deleteTrigger = objectName(this.name, 'entry_delete')
    const viewName = objectName(this.name, 'entries')
    await this.#db.run(
      sql`drop trigger if exists ${sql.identifier(insertTrigger)}`
    )
    await this.#db.run(
      sql`drop trigger if exists ${sql.identifier(updateTrigger)}`
    )
    await this.#db.run(
      sql`drop trigger if exists ${sql.identifier(deleteTrigger)}`
    )
    await this.#db.run(sql`drop view if exists ${sql.identifier(viewName)}`)
    await this.#db.run(
      sql`drop table if exists ${sql.identifier(this.searchName)}`
    )
    await this.#db.drop(this.#entryChanges, this.#keys, this.state)
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }
}
