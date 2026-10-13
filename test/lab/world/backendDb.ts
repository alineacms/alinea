/**
 * The backend database of a self-hosted setup, shared by every isolate as
 * D1 or Postgres would be. `DatabaseApi` keeps users, uploads and content
 * blobs in it; here it is WASM SQLite on the page, reached through a D1
 * binding over the lab network.
 */
import type {Database as WasmSqlite} from '@alinea/sqlite-wasm/Database.js'
import {wasmSqlite} from '#/database/driver/WasmDatabase.js'
import {bus} from './bus.js'
import {network} from './network.js'

interface Query {
  sql: string
  params: Array<unknown>
  mode?: 'all' | 'raw' | 'run' | 'exec'
}

export type BackendDriver = 'libsql' | 'd1'

class BackendDatabase {
  node = 'backend-db'
  /** How isolates reach this database: the driver `DatabaseApi` uses. */
  driver: BackendDriver = 'libsql'
  #db: Promise<WasmSqlite> | undefined
  statements = 0
  /** The transaction holding the database, which others wait for. */
  #holder: number | undefined
  #waiting: Array<() => void> = []
  #nextTx = 1

  async begin(): Promise<number> {
    const db = await this.db
    while (this.#holder !== undefined)
      await new Promise<void>(resolve => this.#waiting.push(resolve))
    const tx = this.#nextTx++
    this.#holder = tx
    db.exec('begin')
    return tx
  }

  async end(tx: number, commit: boolean) {
    if (this.#holder !== tx) return
    try {
      ;(await this.db).exec(commit ? 'commit' : 'rollback')
    } catch {}
    this.#holder = undefined
    for (const resume of this.#waiting.splice(0)) resume()
  }

  async execute({sql, args}: {sql: string; args: Array<unknown>; tx?: number}) {
    const recreated = /^create table "new_(\w+)"/.exec(sql)
    if (recreated)
      bus.log({
        node: this.node,
        kind: 'finding',
        text: `⚑ migration rebuilds ${recreated[1]} (copy, drop, rename): rado's SQLite diff reads no unique or references from pragma_table_info, so each new instance sees a changed table`
      })
    // Statements outside the transaction run on the one connection too, as
    // reads of another connection would; only transactions wait in turn.
    const db = await this.db
    this.statements++
    let statement: ReturnType<WasmSqlite['prepare']>
    try {
      statement = db.prepare(withTableInfo(db, sql))
    } catch (error) {
      console.error('backend db failed:', sql)
      throw error
    }
    try {
      statement.bind(args as any)
      const rows: Array<Array<unknown>> = []
      while (statement.step()) rows.push(statement.get())
      const columns = statement.getColumnNames()
      const rowsAffected = db.getRowsModified()
      const last = db.exec('select last_insert_rowid()')[0]?.values[0][0]
      return {columns, rows, rowsAffected, lastInsertRowid: Number(last ?? 0)}
    } finally {
      statement.free()
    }
  }

  get db() {
    return (this.#db ??= wasmSqlite().then(Database => new Database()))
  }

  async reset() {
    const db = await this.#db
    db?.close()
    this.#db = undefined
    this.#holder = undefined
    this.statements = 0
  }

  async query({sql, params, mode = 'all'}: Query) {
    const db = await this.db
    this.statements++
    if (mode === 'exec') {
      db.exec(sql)
      return {results: [], rows: [], meta: {changes: 0, last_row_id: 0}}
    }
    const statement = db.prepare(sql)
    try {
      statement.bind(params as any)
      const results: Array<Record<string, unknown>> = []
      const rows: Array<Array<unknown>> = []
      while (statement.step()) {
        if (mode === 'raw') rows.push(statement.get())
        else results.push(statement.getAsObject())
      }
      const changes = db.getRowsModified()
      return {results, rows, meta: {changes, last_row_id: 0}}
    } finally {
      statement.free()
    }
  }

  async tables() {
    const db = await this.db
    const names =
      db
        .exec(`select name from sqlite_master where type = 'table'`)[0]
        ?.values.map((row: Array<unknown>) => String(row[0])) ?? []
    return names.map((name: string) => ({
      name,
      rows: Number(db.exec(`select count(*) from "${name}"`)[0].values[0][0])
    }))
  }

  async blobs() {
    const db = await this.db
    try {
      const result = db.exec(
        'select sha, length(content), usedAt from alinea_blob order by usedAt desc'
      )[0]
      return (result?.values ?? []).map(
        ([sha, size, usedAt]: Array<unknown>) => ({
          sha: String(sha),
          size: Number(size),
          usedAt: Number(usedAt)
        })
      )
    } catch {
      return []
    }
  }

  describe(sql: string) {
    const verb = sql.trim().split(/\s+/)[0].toLowerCase()
    const table = /(alinea_\w+)/.exec(sql)?.[1] ?? ''
    return `${verb} ${table}`.trim()
  }
}

/**
 * Alinea's WASM SQLite build leaves out foreign keys and the schema pragmas
 * rado's migrations read, which hosted SQLite databases have: drop the
 * references, and answer `pragma_table_info` from a temporary table filled
 * from the stored definition of the table.
 */
export function withTableInfo(db: WasmSqlite, sql: string): string {
  const rename = /^alter table "(\w+)" rename to "(\w+)"$/.exec(sql.trim())
  if (rename) {
    // No ALTER TABLE either: copy the table under its new name
    const [, from, to] = rename
    const definition = String(
      db.exec(
        `select sql from sqlite_master where type = 'table' and name = ?`,
        [from]
      )[0].values[0][0]
    )
    db.exec(definition.replace(`"${from}"`, `"${to}"`))
    db.exec(`insert into "${to}" select * from "${from}"`)
    db.exec(`drop table "${from}"`)
    return 'select 1 where 0'
  }
  return sql
    .replace(/ references "\w+"\("\w+"\)/g, '')
    .replace(/pragma_table_info\('([^']+)'\)/g, (_, name: string) => {
      const table = `lab_table_info_${name.replace(/\W/g, '_')}`
      db.exec(`drop table if exists temp.${table}`)
      db.exec(
        `create temp table ${table} (cid, name, type, "notnull", dflt_value, pk)`
      )
      for (const row of tableInfo(db, name))
        db.run(`insert into temp.${table} values (?, ?, ?, ?, ?, ?)`, row)
      return `temp.${table}`
    })
}

/** The columns of a table as `pragma table_info` lists them. */
function tableInfo(db: WasmSqlite, name: string) {
  const definition = db.exec(
    `select sql from sqlite_master where type = 'table' and name = ?`,
    [name]
  )[0]?.values[0]?.[0]
  if (typeof definition !== 'string') return []
  const body = definition.slice(definition.indexOf('(') + 1, -1)
  const columns: Array<string> = []
  let depth = 0
  let current = ''
  for (const char of body) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      columns.push(current.trim())
      current = ''
    } else current += char
  }
  if (current.trim()) columns.push(current.trim())
  return columns.map((column, cid) => {
    const [, columnName, rest] = /^"([^"]+)"\s*(.*)$/.exec(column) ?? []
    const lower = rest.toLowerCase()
    const type = /^[a-z]+(\([^)]*\))?/.exec(lower)?.[0] ?? ''
    const fallback = /default (\S+)/.exec(rest)?.[1] ?? null
    return [
      cid,
      columnName,
      type,
      lower.includes('not null') ? 1 : 0,
      fallback,
      lower.includes('primary key') ? 1 : 0
    ]
  })
}

export const backendDb = new BackendDatabase()

network.rpc('db.query', async (query: Query, from) => {
  const result = await backendDb.query(query)
  if (!/^\s*(pragma|select name from sqlite_master)/i.test(query.sql)) {
    bus.send({
      from,
      to: backendDb.node,
      label: backendDb.describe(query.sql),
      duration: 150,
      kind: 'event'
    })
    if (/alinea_blob/.test(query.sql))
      bus.log({
        node: backendDb.node,
        kind: 'sql',
        text: `${from}: ${backendDb.describe(query.sql)} (${query.mode === 'run' ? `${result.meta.changes} changed` : `${result.results.length + result.rows.length} rows`})`
      })
  }
  bus.flash(backendDb.node)
  return result
})

network.rpc(
  'db.batch',
  async ({statements}: {statements: Array<Query>}, from) => {
    const results = []
    for (const statement of statements)
      results.push(await backendDb.query({...statement, mode: 'all'}))
    bus.send({
      from,
      to: backendDb.node,
      label: `batch ×${statements.length}`,
      duration: 150,
      kind: 'event'
    })
    return results
  }
)

network.rpc('db.begin', async (_args, from) => {
  const tx = await backendDb.begin()
  bus.send({
    from,
    to: backendDb.node,
    label: 'begin',
    duration: 150,
    kind: 'event'
  })
  return tx
})

network.rpc('db.end', ({tx, commit}: {tx: number; commit: boolean}, from) => {
  bus.send({
    from,
    to: backendDb.node,
    label: commit ? 'commit' : 'rollback',
    duration: 150,
    kind: 'event'
  })
  return backendDb.end(tx, commit)
})

network.rpc(
  'db.execute',
  async (input: {sql: string; args: Array<unknown>; tx?: number}, from) => {
    const result = await backendDb.execute(input)
    if (!/^\s*(pragma|select name from sqlite_master)/i.test(input.sql)) {
      bus.send({
        from,
        to: backendDb.node,
        label: backendDb.describe(input.sql),
        duration: 150,
        kind: 'event'
      })
      if (/alinea_blob/.test(input.sql))
        bus.log({
          node: backendDb.node,
          kind: 'sql',
          text: `${from}: ${backendDb.describe(input.sql)} (${/^\s*select/i.test(input.sql) ? `${result.rows.length} rows` : `${result.rowsAffected} changed`})`
        })
    }
    bus.flash(backendDb.node)
    return result
  }
)
