import convertHrtime from 'convert-hrtime'
import prettyMilliseconds from 'pretty-ms'
import {Collection, CollectionImpl} from '../Collection.js'
import {CursorImpl} from '../Cursor.js'
import {Driver} from '../Driver.js'
import {Expr} from '../Expr.js'
import {Fields} from '../Fields.js'
import {From, FromType} from '../From.js'
import {sql} from '../Statement.js'
import {IdLess, QueryOptions, Store} from '../Store.js'
import type {Update} from '../Update.js'
import {sqliteFormatter} from './SqliteFormatter.js'

const f = sqliteFormatter

type CreateId = () => string

const NO_TABLE = 'no such table: '
function isMissingTable(error: any): string | undefined {
  const e = String(error)
  const index = e.indexOf(NO_TABLE)
  if (index === -1) return
  return e
    .slice(index + NO_TABLE.length)
    .split('.')
    .pop()
}

function ifMissing<T>(defaultValue: T, run: () => T) {
  try {
    return run()
  } catch (e) {
    if (isMissingTable(e)) return defaultValue
    throw e
  }
}

export class SqliteStore implements Store {
  constructor(private db: Driver, private createId: CreateId) {
    this.db = db
    this.createId = createId
    // this.db.exec('PRAGMA journal_mode = WAL')
    // this.db.exec('PRAGMA optimize')
    // Since we're only using the db in memory and they're computed from a
    // source we don't need acid guarantees
    this.db.exec('PRAGMA synchronous = OFF')
    this.db.exec('PRAGMA journal_mode = MEMORY')
  }

  private debug<T>(run: () => T, log = false): T {
    if (!log) return run()
    const startTime = process.hrtime.bigint()
    const result = run()
    const diff = process.hrtime.bigint() - startTime
    console.log(
      `\r> Queried in ${prettyMilliseconds(convertHrtime(diff).milliseconds, {
        millisecondsDecimalDigits: 2
      })}`
    )
    return result
  }

  all<Row>(cursor: CursorImpl<Row>, options?: QueryOptions): Array<Row> {
    const stmt = f.formatSelect(cursor.cursor, {
      formatAsJson: true,
      formatSubject: subject => sql`json_object('result', ${subject})`
    })
    if (options?.debug) {
      console.log(f.formatSelect(cursor.cursor, {formatInline: true}).sql)
    }
    return ifMissing([], () => {
      const prepared = this.prepare(stmt.sql)
      return this.debug(
        () => prepared.all<string>(stmt.getParams()),
        options?.debug
      ).map((col: any) => {
        return JSON.parse(col).result
      })
    })
  }

  first<Row>(cursor: CursorImpl<Row>, options?: QueryOptions): Row | null {
    return ifMissing(null, () => {
      return this.all(cursor.take(1), options)[0] || null
    })
  }

  sure<Row>(cursor: CursorImpl<Row>, options?: QueryOptions): Row {
    const res = this.first(cursor, options)
    if (!res) throw new Error(`Not found`)
    return res
  }

  delete<Row>(
    cursor: CursorImpl<Row>,
    options?: QueryOptions
  ): {changes: number} {
    return ifMissing({changes: 0}, () => {
      const stmt = f.formatDelete(cursor.cursor)
      return this.prepare(stmt.sql).run(stmt.getParams())
    })
  }

  count<Row>(cursor: CursorImpl<Row>, options?: QueryOptions): number {
    return ifMissing(0, () => {
      const stmt = f.formatSelect(cursor.cursor)
      return this.prepare(`select count() from (${stmt.sql})`).get(
        stmt.getParams()
      )
    })
  }

  insertAll<Row>(
    collection: Collection<Row>,
    objects: Array<IdLess<Row>>,
    options?: QueryOptions
  ): Array<Row> {
    const res = []
    for (let object of objects) {
      const id = collection.__collectionId.getFromRow(object)
      const row = !id
        ? collection.__collectionId.addToRow(object, this.createId())
        : object
      const from = collection.cursor.from
      if (from.type === FromType.Column) {
        this.prepare(
          `insert into ${f.escapeId(From.source(from.of))} values (?)`,
          collection
        ).run([JSON.stringify(row)])
      } else if (from.type === FromType.Table) {
        this.prepare(
          `insert into ${f.escapeId(from.name)} values (${from.columns
            .map(_ => '?')
            .join(', ')})`,
          collection
        ).run(from.columns.map(col => (row as any)[col]))
      }
      res.push(row)
    }
    return res as Array<Row>
  }

  insert<Row>(
    collection: Collection<Row>,
    object: IdLess<Row>,
    options?: QueryOptions
  ): Row {
    return this.insertAll(collection, [object], options)[0]
  }

  update<Row>(
    cursor: CursorImpl<Row>,
    update: Update<Row>,
    options?: QueryOptions
  ): {changes: number} {
    return ifMissing({changes: 0}, () => {
      const stmt = f.formatUpdate(cursor.cursor, update)
      return this.prepare(stmt.sql).run(stmt.getParams())
    })
  }

  createIndex<Row>(
    collection: CollectionImpl<Row>,
    name: string,
    on: Array<Expr<any>>
  ) {
    const tableName = From.source(collection.cursor.from)
    const table = f.escapeId(tableName)
    const exprs = []
    for (const expr of on) {
      const stmt = f.formatExpr(expr.expr, {
        formatInline: true,
        formatAsJson: false,
        formatShallow: true
      })
      exprs.push(stmt.sql)
    }
    const res = `create index if not exists ${f.escapeString(
      [tableName, name].join('.')
    )} on ${table}(${exprs.join(', ')});`
    return this.createOnMissing(() => this.db.exec(res), collection)
  }

  transaction<T>(run: () => T): T {
    return this.db.transaction(run)
  }

  export() {
    return this.db.export()
  }

  prepared = new Map()
  prepare(
    query: string,
    collection?: Collection<any>
  ): Driver.PreparedStatement {
    //if (this.prepared.has(query)) return this.prepared.get(query)
    try {
      const result = collection
        ? this.createOnMissing(() => this.db.prepare(query), collection)
        : this.db.prepare(query)
      //this.prepared.set(query, result)
      return result
    } catch (e: any) {
      throw new Error(`Could not prepare query:\n${query}\nCause: ${e}`)
    }
  }

  createFts5<Row extends {}>(
    collection: CollectionImpl<Row>,
    name: string,
    fields: (collection: Fields<Row>) => Record<string, Expr<string>>
  ): boolean {
    const created = this.createFts5Table(collection, name, fields)
    if (created) this.createFts5Triggers(collection, name, fields)
    return created
  }

  createFts5Table<Row extends {}>(
    collection: CollectionImpl<Row>,
    name: string,
    fields: (collection: Fields<Row>) => Record<string, Expr<string>>
  ): boolean {
    const newFields = fields(collection.as('new'))
    const keys = Object.keys(newFields).map(key => f.escapeId(key))
    try {
      const instruction = `create virtual table ${f.escapeId(
        name
      )} using fts5(id unindexed, ${keys.join(', ')})`
      this.db.exec(instruction)
      return true
    } catch (e: any) {
      if (e.message.includes('already exists')) return false
      else throw e
    }
  }

  createFts5Triggers<Row extends {}>(
    collection: CollectionImpl<Row>,
    name: string,
    fields: (collection: Fields<Row>) => Record<string, Expr<string>>
  ) {
    const options = {
      formatInline: true,
      formatAsJson: false,
      formatShallow: true
    }
    const table = f.formatFrom(collection.cursor.from, options)
    const idx = f.escapeId(name)
    const newFields = fields(collection.as('new'))
    const keys = Object.keys(newFields).map(key => f.escapeId(key))
    const origins = fields(collection as any)
    const originValues = Object.values(origins)
      .map(expr => {
        return f.formatExpr(expr.expr, options).sql
      })
      .join(', ')
    const newValues = Object.values(newFields).map(expr => {
      return f.formatExpr(expr.expr, options).sql
    })
    const setters = keys.map((key, i) => {
      return `${key}=${newValues[i]}`
    })
    const id = f.formatExpr(collection.id.expr, {
      formatInline: true,
      formatAsJson: false,
      formatShallow: true
    })
    const instruction = `
      create trigger ${f.escapeId(`${name}_ai`)} after insert on ${table} begin
        insert into ${idx}(id, ${keys.join(
      ', '
    )}) values (${id}, ${newValues.join(', ')});
      end;
      create trigger ${f.escapeId(`${name}_ad`)} after delete on ${table} begin
        delete from ${idx} where id=json_extract(old.data, ${id});
      end;
      create trigger ${f.escapeId(`${name}_au`)} after update on ${table} begin
        update ${idx} set ${setters} where id=json_extract(new.data, ${id});
      end;
      insert into ${f.escapeId(name)}(id, ${keys.join(', ')})
        select ${id}, ${originValues}
        from ${table};
    `
    this.db.exec(instruction)
  }

  createOnMissing<T>(
    run: () => T,
    collection: Collection<any>,
    retry?: string
  ): T {
    try {
      return run()
    } catch (e) {
      const table = isMissingTable(e)
      if (table && retry != table) {
        this.createTable(collection)
        return this.createOnMissing(run, collection, table)
      }
      throw e
    }
  }

  createTable(collection: Collection<any>) {
    const tableName = From.source(collection.cursor.from)
    this.db.exec(
      `create table if not exists ${f.escapeId(tableName)}(data json);`
    )
    this.createIndex(collection, 'id', [collection.id])
  }
}
