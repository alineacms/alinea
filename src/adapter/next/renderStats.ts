import type {GraphQuery} from '#/core/Graph.js'
import type {PreviewStat, PreviewStats} from '#/preview/widget.js'

/** Collects the CMS queries and syncs of one draft render. */
export class RenderStats {
  rows: Array<PreviewStat> = []
  statements = 0
  sqlMs = 0
  #pending = 0
  #idleSince = Date.now()
  #renderStart = Number.POSITIVE_INFINITY
  #renderEnd = Number.NEGATIVE_INFINITY
  #executedUntil = Number.NEGATIVE_INFINITY

  /** Add a row and count it as pending until `run` settles; see `timed`. */
  async track<T>(
    stat: Omit<PreviewStat, 'durationMs'>,
    run: (row: PreviewStat) => Promise<T>
  ): Promise<T> {
    const row: PreviewStat = {...stat, durationMs: 0}
    this.rows.push(row)
    this.#pending++
    this.#renderStart = Math.min(this.#renderStart, performance.now())
    try {
      return await run(row)
    } finally {
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
    try {
      return await run()
    } finally {
      const end = performance.now()
      row.durationMs = end - Math.max(start, this.#executedUntil)
      this.#executedUntil = end
    }
  }

  statement(durationMs: number): void {
    this.statements++
    this.sqlMs += durationMs
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
    const {rows, statements, sqlMs} = this
    const renderMs = Math.max(0, this.#renderEnd - this.#renderStart)
    return {rows: [...rows], statements, sqlMs, renderMs}
  }
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
