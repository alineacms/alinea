import type {GraphQuery} from '#/core/Graph.js'
import type {
  PreviewDatabase,
  PreviewStat,
  PreviewStatement,
  PreviewStats
} from '#/preview/widget.js'

/** How many of the slowest statements a render keeps. */
const slowestCount = 5

/** Collects the CMS queries and syncs of one draft render. */
export class RenderStats {
  rows: Array<PreviewStat> = []
  statements = 0
  sqlMs = 0
  slowest: Array<PreviewStatement> = []
  /** The bundled database that answered, once a query reached it. */
  database?: PreviewDatabase
  readonly startedAt = Date.now()
  #pending = 0
  #idleSince = Date.now()
  #renderStart = Number.POSITIVE_INFINITY
  #renderEnd = Number.NEGATIVE_INFINITY
  #executedUntil = Number.NEGATIVE_INFINITY
  /** Syncs in progress: their statements run before any query's. */
  #syncing: Array<PreviewStat> = []
  /** Queries executing or waiting to, in the order they run. */
  #executing: Array<PreviewStat> = []

  /** Add a row and count it as pending until `run` settles; see `timed`. */
  async track<T>(
    stat: Omit<PreviewStat, 'durationMs'>,
    run: (row: PreviewStat) => Promise<T>
  ): Promise<T> {
    const row: PreviewStat = {...stat, durationMs: 0}
    this.rows.push(row)
    this.#pending++
    this.#renderStart = Math.min(this.#renderStart, performance.now())
    if (row.kind === 'sync') this.#syncing.push(row)
    try {
      return await run(row)
    } finally {
      if (row.kind === 'sync') remove(this.#syncing, row)
      this.#pending--
      this.#idleSince = Date.now()
      this.#renderEnd = Math.max(this.#renderEnd, performance.now())
    }
  }

  /**
   * Time a database query without the time it waited behind the others:
   * queries of a render run one at a time in the order they were called, so
   * one starts executing once the previous one finished, or when it was
   * called if that is later.
   */
  async executed<T>(row: PreviewStat, run: () => Promise<T>): Promise<T> {
    const start = performance.now()
    this.#executing.push(row)
    try {
      return await run()
    } finally {
      remove(this.#executing, row)
      const end = performance.now()
      row.durationMs = end - Math.max(start, this.#executedUntil)
      this.#executedUntil = end
    }
  }

  /**
   * Count a statement towards the render, and towards the row that ran it:
   * a sync in progress, or else the query executing, which is the earliest
   * one called that has not finished (see `executed`).
   */
  statement(durationMs: number, sql?: string): void {
    this.statements++
    this.sqlMs += durationMs
    const row = this.#syncing.at(-1) ?? this.#executing[0]
    if (row) {
      row.statements = (row.statements ?? 0) + 1
      row.sqlMs = (row.sqlMs ?? 0) + durationMs
    }
    if (sql === undefined) return
    const {slowest} = this
    if (
      slowest.length >= slowestCount &&
      durationMs <= slowest[slowest.length - 1].durationMs
    )
      return
    slowest.push({sql: summarizeSql(sql), durationMs, query: row?.summary})
    slowest.sort((a, b) => b.durationMs - a.durationMs)
    slowest.length = Math.min(slowest.length, slowestCount)
  }

  /**
   * Resolves once nothing ran for `quietMs`, so queries of server components
   * that render after the caller are counted, or after `maxMs` regardless.
   */
  async settled(quietMs = 50, maxMs = 5000): Promise<PreviewStats> {
    const deadline = Date.now() + maxMs
    for (let now = Date.now(); now < deadline; now = Date.now()) {
      const wait = this.#pending > 0 ? quietMs : this.#idleSince + quietMs - now
      if (wait <= 0) break
      await new Promise(resolve =>
        setTimeout(resolve, Math.min(wait, deadline - now))
      )
    }
    const {rows, statements, sqlMs, slowest, database} = this
    const renderMs = Math.max(0, this.#renderEnd - this.#renderStart)
    return {
      rows: rows.map(row => ({...row})),
      statements,
      sqlMs,
      renderMs,
      slowest: [...slowest],
      database
    }
  }
}

/**
 * A statement short enough to read in a table, such as
 * `select … from alinea_entry_index where (visible = ? and id in (?))`.
 */
export function summarizeSql(sql: string, maxLength = 200): string {
  const text = sql
    .replace(/\s+/g, ' ')
    .replaceAll('"', '')
    .replace(/^select .*? from /i, 'select … from ')
    // Columns are named by their table in every clause.
    .replace(/\b\w+\.(\w+)/g, '$1')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

/**
 * Time the work a row stands for from call to answer, such as a sync or a
 * query the handler answers, without the sync it waited for.
 */
export async function timed<T>(
  row: PreviewStat | undefined,
  run: () => Promise<T>
): Promise<T> {
  if (!row) return run()
  const start = performance.now()
  try {
    return await run()
  } finally {
    row.durationMs += performance.now() - start
  }
}

const unlisted = new Set([
  'first',
  'get',
  'count',
  'select',
  'include',
  'status',
  'preview',
  'syncInterval',
  'disableSync'
])

/** A short description such as `first(type, url=/about)`. */
export function summarizeQuery(query: GraphQuery): string {
  const mode = query.count
    ? 'count'
    : query.get
      ? 'get'
      : query.first
        ? 'first'
        : 'find'
  const parts = Object.entries(query)
    .filter(([key, value]) => !unlisted.has(key) && value !== undefined)
    .map(([key, value]) =>
      typeof value === 'string' || typeof value === 'number'
        ? `${key}=${value}`
        : key
    )
  return `${mode}(${parts.join(', ')})`
}

function remove<T>(items: Array<T>, item: T): void {
  const index = items.indexOf(item)
  if (index !== -1) items.splice(index, 1)
}
