import type {GraphQuery} from '#/core/Graph.js'
import type {PreviewStat, PreviewStats} from '#/preview/widget.js'

/** Collects the CMS queries and syncs of one draft render. */
export class RenderStats {
  rows: Array<PreviewStat> = []
  statements = 0
  sqlMs = 0
  #pending = 0
  #idleSince = Date.now()

  /** Add a row and count it as pending until `run` settles; see `timed`. */
  async track<T>(
    stat: Omit<PreviewStat, 'durationMs'>,
    run: (row: PreviewStat) => Promise<T>
  ): Promise<T> {
    const row: PreviewStat = {...stat, durationMs: 0}
    this.rows.push(row)
    this.#pending++
    try {
      return await run(row)
    } finally {
      this.#pending--
      this.#idleSince = Date.now()
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
    return {rows: [...rows], statements, sqlMs}
  }
}

/**
 * Time the work a row stands for, such as answering a query without the sync
 * it waited for.
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
