import {getTable, sql, temporaryTable, type Database} from 'rado'
import {DatabaseStateColumns} from '../DatabaseTables.js'
import {
  createSearch,
  dropVocabulary,
  entrySearchTable
} from '../query/Search.js'
import type {EntrySyncTarget} from '../sync/EntrySyncer.js'
import {EntryIndexColumns, entryIndexTable} from './EntryTable.js'

const views = new WeakMap<EntrySyncTarget['entries'], EntryView>()

/** The tables reads of a target go to: an unwritten view reads its parent's. */
export function entryReadTarget(target: EntrySyncTarget): EntrySyncTarget {
  return views.get(target.entries)?.readTarget ?? target
}

/**
 * Named, copy-on-write entry and search tables over another target. A view
 * reads its parent until the first write copies the parent's rows into
 * temporary tables of its own, which from then on no longer follow the parent.
 */
export class EntryView {
  readonly target: EntrySyncTarget
  readonly #db: Database
  readonly #parent: EntrySyncTarget
  #copy?: Promise<void>
  #copied = false
  #closed = false

  private constructor(db: Database, name: string, parent: EntrySyncTarget) {
    this.#db = db
    this.#parent = parent
    this.target = {
      entries: entryIndexTable(`alinea_${name}_entries`, true),
      state: temporaryTable(`alinea_${name}_state`, DatabaseStateColumns),
      search: entrySearchTable(`alinea_${name}_search`, true),
      recordsTree: false
    }
    views.set(this.target.entries, this)
  }

  static async create(
    db: Database,
    name: string,
    parent: EntrySyncTarget,
    revision: string
  ): Promise<EntryView> {
    const view = new EntryView(db, name, parent)
    try {
      await db.create(view.target.state)
      await db.insert(view.target.state).values({id: 1, revision, tree: null})
      return view
    } catch (error) {
      await view.close()
      throw error
    }
  }

  get readTarget(): EntrySyncTarget {
    return this.#copied ? this.target : entryReadTarget(this.#parent)
  }

  /**
   * Copy the parent's rows into this view's tables. Await this before every
   * write through the view: until then reads go to the parent.
   */
  diverge(): Promise<void> {
    this.#copy ??= this.#materialize().catch(error => {
      this.#copy = undefined
      throw error
    })
    return this.#copy
  }

  async #materialize(): Promise<void> {
    const {entries, search} = this.target
    const parent = entryReadTarget(this.#parent)
    const table = getTable(entries)
    // The rowid column keeps each entry row next to its search row.
    const columns = sql.join(
      Object.keys(EntryIndexColumns).map(name => sql.identifier(name)),
      sql`, `
    )
    try {
      await this.#db.run(table.createTable())
      await this.#db.run(sql`insert into ${entries} (${columns})
        select ${columns} from ${parent.entries}`)
      // Indexing the filled table is faster than filling an indexed one.
      for (const index of table.createIndexes()) await this.#db.run(index)
      await createSearch(this.#db, search)
      await this.#db.run(sql`insert into ${search} (rowid, title, body)
        select rowid, title, body from ${parent.search}`)
    } catch (error) {
      await this.#dropCopies()
      throw error
    }
    this.#copied = true
  }

  async #dropCopies(): Promise<void> {
    await this.#db.run(sql`drop table if exists ${this.target.search}`)
    await this.#db.drop(this.target.entries)
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await dropVocabulary(this.#db, this.target.search)
    await this.#dropCopies()
    await this.#db.drop(this.target.state)
  }
}
