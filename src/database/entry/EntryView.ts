import {getTable, sql, temporaryTable, type Database, type Table} from 'rado'
import {DatabaseStateColumns} from '../DatabaseTables.js'
import {dropVocabulary} from '../query/Search.js'
import {
  EntryIndexColumns,
  entryIndexTable,
  type EntryIndexTarget
} from './EntryTable.js'

const views = new WeakMap<EntryIndexTarget, EntryView>()

/** The table reads of a target go to: an unwritten view reads its parent. */
export function entryReadTarget(target: EntryIndexTarget): EntryIndexTarget {
  return views.get(target)?.readTarget ?? target
}

/**
 * A named, copy-on-write entry table over another entry table or view. It
 * reads its parent until the first write copies the parent's rows into a
 * temporary table of its own, which from then on no longer follows the parent.
 */
export class EntryView {
  readonly entries: EntryIndexTarget
  readonly searchName: string
  readonly state: Table<typeof DatabaseStateColumns>
  readonly #db: Database
  readonly #parent: EntryIndexTarget
  #copy?: Promise<void>
  #copied = false
  #closed = false

  private constructor(db: Database, name: string, parent: EntryIndexTarget) {
    this.#db = db
    this.#parent = parent
    this.entries = entryIndexTable(`alinea_${name}_entries`, true)
    this.searchName = `alinea_${name}_search`
    this.state = temporaryTable(`alinea_${name}_state`, DatabaseStateColumns)
    views.set(this.entries, this)
  }

  static async create(
    db: Database,
    name: string,
    parent: EntryIndexTarget,
    revision: string
  ): Promise<EntryView> {
    const view = new EntryView(db, name, parent)
    try {
      await db.create(view.state)
      await db.insert(view.state).values({id: 1, revision, tree: null})
      return view
    } catch (error) {
      await view.close()
      throw error
    }
  }

  get readTarget(): EntryIndexTarget {
    return this.#copied ? this.entries : entryReadTarget(this.#parent)
  }

  /**
   * Copy the parent's rows into this view's table. Await this before every
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
    const table = getTable(this.entries)
    const columns = sql.join(
      Object.keys(EntryIndexColumns).map(name => sql.identifier(name)),
      sql`, `
    )
    try {
      await this.#db.run(table.createTable())
      await this.#db.run(sql`insert into ${this.entries} (${columns})
        select ${columns} from ${entryReadTarget(this.#parent)}`)
      // Indexing the filled table is faster than filling an indexed one.
      for (const index of table.createIndexes()) await this.#db.run(index)
    } catch (error) {
      await this.#db.drop(this.entries)
      throw error
    }
    this.#copied = true
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await dropVocabulary(this.#db, this.searchName)
    await this.#db.run(
      sql`drop table if exists ${sql.identifier(this.searchName)}`
    )
    await this.#db.drop(this.entries, this.state)
  }
}
