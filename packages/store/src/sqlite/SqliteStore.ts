import convertHrtime from 'convert-hrtime'
import prettyMilliseconds from 'pretty-ms'
import {Collection} from '../Collection'
import {Cursor} from '../Cursor'
import {Driver} from '../Driver'
import {Expr} from '../Expr'
import {From, FromType} from '../From'
import {postProcess, SelectionType} from '../Selection'
import {Document, IdLess, QueryOptions, Store} from '../Store'
import type {Update} from '../Update'
import {sqliteFormatter} from './SqliteFormatter'

const f = sqliteFormatter

type CreateId = () => string

export class SqliteStore implements Store {
  constructor(private db: Driver, private createId: CreateId) {
    this.db = db
    this.createId = createId
    //this.db.exec('PRAGMA journal_mode = WAL')
    //this.db.exec('PRAGMA optimize')
  }

  all<Row>(cursor: Cursor<Row>, options?: QueryOptions): Array<Row> {
    const stmt = f.formatSelect(cursor.cursor)
    const isJson = cursor.cursor.selection.type !== SelectionType.Expr
    return this.prepare(stmt.sql, options)
      .all<string>(stmt.getParams())
      .map((col: any) => (isJson ? JSON.parse(col) : col))
      .map(res => postProcess(cursor.cursor.selection, res))
  }

  first<Row>(cursor: Cursor<Row>, options?: QueryOptions): Row | null {
    return this.all(cursor.take(1), options)[0] || null
  }

  delete<Row>(cursor: Cursor<Row>, options?: QueryOptions): {changes: number} {
    const stmt = f.formatDelete(cursor.cursor)
    return this.prepare(stmt.sql, options).run(stmt.getParams())
  }

  count<Row>(cursor: Cursor<Row>, options?: QueryOptions): number {
    const stmt = f.formatSelect(cursor.cursor)
    return this.prepare(`select count() from (${stmt.sql})`, options).get(
      stmt.getParams()
    )
  }

  insertAll<Row extends Document>(
    collection: Collection<Row>,
    objects: Array<IdLess<Row>>,
    options?: QueryOptions
  ): Array<Row> {
    return this.db.transaction(() => {
      const res = []
      for (let object of objects) {
        if (!object.id) object = {...object, id: this.createId()}
        const from = collection.cursor.from
        if (from.type === FromType.Column) {
          this.prepare(
            `insert into ${f.escapeId(From.source(from.of))} values (?)`,
            options
          ).run([JSON.stringify(object)])
        } else if (from.type === FromType.Table) {
          this.prepare(
            `insert into ${f.escapeId(from.name)} values (${from.columns
              .map(_ => '?')
              .join(', ')})`,
            options
          ).run(from.columns.map(col => (object as any)[col]))
        }
        res.push(object)
      }
      return res as Array<Row>
    })
  }

  insert<Row extends Document>(
    collection: Collection<Row>,
    object: IdLess<Row>,
    options?: QueryOptions
  ): Row {
    return this.insertAll(collection, [object], options)[0]
  }

  update<Row>(
    cursor: Cursor<Row>,
    update: Update<Row>,
    options?: QueryOptions
  ): {changes: number} {
    return this.db.transaction(() => {
      const stmt = f.formatUpdate(cursor.cursor, update)
      return this.prepare(stmt.sql, options).run(stmt.getParams())
    })
  }

  createIndex<Row extends Document>(
    collection: Collection<Row>,
    name: string,
    on: Array<Expr<any>>
  ) {
    const tableName = From.source(collection.cursor.from)
    const table = f.escapeId(tableName)
    const exprs = []
    for (const expr of on) {
      const stmt = f.formatExpr(expr.expr, {
        formatInline: true,
        formatAsJsonValue: false,
        formatShallow: true
      })
      if (stmt.params.length > 0) {
        throw 'Parameters in index expressions are currently unsupported'
      }
      exprs.push(stmt.sql)
    }
    const res = `create index if not exists ${f.escapeString(
      [tableName, name].join('.')
    )} on ${table}(${exprs.join(', ')});`
    return this.createOnError(() => this.db.exec(res))
  }

  transaction<T>(run: () => T): T {
    return this.db.transaction(run)
  }

  export() {
    return this.db.export()
  }

  prepare(query: String, options?: QueryOptions): Driver.PreparedStatement {
    if (options?.debug) {
      const startTime = process.hrtime.bigint()
      console.log(query)
      const result = this.createOnError(() => this.db.prepare(query))
      const diff = process.hrtime.bigint() - startTime
      console.log(
        `\r> Queried in ${prettyMilliseconds(convertHrtime(diff).milliseconds)}`
      )
      return result
    } else {
      return this.createOnError(() => this.db.prepare(query))
    }
  }

  createFts5<Row extends {}>(
    collection: Collection<Row>,
    name: string,
    fields: (collection: Collection<Row>) => Record<string, Expr<string>>
  ): boolean {
    const created = this.createFts5Table(collection, name, fields)
    if (created) this.createFts5Triggers(collection, name, fields)
    return created
  }

  createFts5Table<Row extends {}>(
    collection: Collection<Row>,
    name: string,
    fields: (collection: Collection<Row>) => Record<string, Expr<string>>
  ): boolean {
    const exists = this.db
      .prepare('select distinct tbl_name from sqlite_master where tbl_name = ?')
      .get([name])
    if (exists) return false
    const newFields = fields(collection.as('new'))
    const keys = Object.keys(newFields).map(key => f.escapeId(key))
    const instruction = `create virtual table ${f.escapeId(
      name
    )} using fts5(id unindexed, ${keys.join(', ')})`
    this.db.exec(instruction)
    return true
  }

  createFts5Triggers<Row extends {}>(
    collection: Collection<Row>,
    name: string,
    fields: (collection: Collection<Row>) => Record<string, Expr<string>>
  ) {
    const options = {
      formatInline: true,
      formatAsJsonValue: false,
      formatShallow: true
    }
    const table = f.formatFrom(collection.cursor.from, options)
    const idx = f.escapeId(name)
    const newFields = fields(collection.as('new'))
    const keys = Object.keys(newFields).map(key => f.escapeId(key))
    const origins = fields(collection)
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
    const instruction = `
      create trigger ${f.escapeId(`${name}_ai`)} after insert on ${table} begin
        insert into ${idx}(id, ${keys.join(
      ', '
    )}) values (json_extract(new.data, '$.id'), ${newValues.join(', ')});
      end;
      create trigger ${f.escapeId(`${name}_ad`)} after delete on ${table} begin
        delete from ${idx} where id=json_extract(old.data, '$.id');
      end;
      create trigger ${f.escapeId(`${name}_au`)} after update on ${table} begin
        update ${idx} set ${setters} where id=json_extract(new.data, '$.id');
      end;
      insert into ${f.escapeId(name)}(id, ${keys.join(', ')})
        select ${f.formatExpr(collection.id.expr, {
          formatShallow: true
        })}, ${originValues}
        from ${table};
    `
    this.db.exec(instruction)
  }

  createOnError<T>(run: () => T): T {
    const next = (retry?: string): T => {
      try {
        return run()
      } catch (e) {
        const error = String(e)
        const NO_TABLE = 'no such table: '
        const index = error.indexOf(NO_TABLE)
        if (index > -1) {
          const table = error
            .substr(index + NO_TABLE.length)
            .split('.')
            .pop()
          if (retry != table && table != null) {
            this.createTable(table)
            return next(table)
          }
        }
        throw e
      }
    }
    return next()
  }

  createTable(name: string) {
    const collection = new Collection<{id: string}>(name)
    this.db.exec(`create table if not exists ${f.escapeId(name)}(data json);`)
    this.createIndex(collection, 'id', [collection.id])
  }
}
