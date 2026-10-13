/**
 * Clients the lab's isolates use to reach the services of the page over the
 * lab network: the git host and the backend database.
 */
import {
  BLOB_SEQUENCE_CONTENT_TYPE,
  decodeBlobSequence
} from '#/core/BlobTransport.js'
import type {
  CommitApi,
  HistoryApi,
  Revision,
  SyncApi
} from '#/core/Connection.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {EntryRecord} from '#/core/EntryRecord.js'
import {HttpError} from '#/core/HttpError.js'
import type {GetBlobsOptions} from '#/core/source/Source.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {callMain} from './realm.js'
import {githubOrigin} from './schema.js'

/**
 * Stands in for `GithubApi`: the same remote contract (a tree per content
 * sha, blobs by sha, a commit that fails when the branch moved) over a lab
 * protocol instead of GitHub's REST and GraphQL APIs.
 */
export class LabGithub implements SyncApi, CommitApi, HistoryApi {
  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const response = await call('tree', {sha})
    const tree = await response.json()
    return tree ? new ReadonlyTree(tree) : undefined
  }

  async *getBlobs(
    shas: ReadonlyArray<string>,
    options: GetBlobsOptions = {}
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    if (shas.length === 0) return
    const response = await call('blobs', {shas}, options.signal)
    if (!response.body) return
    yield* decodeBlobSequence(response.body)
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    const response = await fetch(`${githubOrigin}/commit`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(request)
    })
    if (response.status === 409) {
      const {actualSha, expectedSha} = await response.json()
      throw new ShaMismatchError(actualSha, expectedSha)
    }
    if (!response.ok)
      throw new HttpError(response.status, await response.text())
    return response.json()
  }

  async revisions(file: string): Promise<Array<Revision>> {
    return (await call('history', {file})).json()
  }

  async revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined> {
    return (await call('revision', {file, revisionId})).json()
  }
}

async function call(path: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch(`${githubOrigin}/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: BLOB_SEQUENCE_CONTENT_TYPE
    },
    body: JSON.stringify(body),
    signal
  })
  if (!response.ok) throw new HttpError(response.status, await response.text())
  return response
}

interface D1Result {
  results: Array<Record<string, unknown>>
  rows: Array<Array<unknown>>
  meta: {changes: number; last_row_id: number}
}

/**
 * A Cloudflare D1 binding whose statements run in the backend database of
 * the page: every isolate shares it, as they would a hosted database.
 */
export function labD1() {
  function statement(sql: string, params: Array<unknown> = []) {
    const run = (mode: string) =>
      callMain<D1Result>('db.query', {sql, params, mode})
    return {
      sql,
      params,
      bind: (...args: Array<unknown>) => statement(sql, args),
      async all() {
        return {results: (await run('all')).results}
      },
      async run() {
        const result = await run('run')
        return {results: [], meta: result.meta}
      },
      async first() {
        return (await run('all')).results[0] ?? null
      },
      async raw() {
        return (await run('raw')).rows
      }
    }
  }
  return {
    prepare: (sql: string) => statement(sql),
    async exec(sql: string) {
      await callMain('db.query', {sql, params: [], mode: 'exec'})
    },
    async batch(statements: Array<ReturnType<typeof statement>>) {
      const results = await callMain<Array<D1Result>>('db.batch', {
        statements: statements.map(s => ({sql: s.sql, params: s.params}))
      })
      return results.map(r => ({results: r.results}))
    }
  }
}

interface ExecuteResult {
  columns: Array<string>
  rows: Array<Array<unknown>>
  rowsAffected: number
  lastInsertRowid: number
}

type Statement = string | {sql: string; args?: Array<unknown>}

/**
 * A libSQL client (as for Turso) whose statements run in the backend
 * database of the page. A transaction holds the database until it ends, as
 * a connection of its own would.
 */
export function labLibsql(tx?: number): any {
  const execute = async (statement: Statement) => {
    const {sql, args = []} =
      typeof statement === 'string' ? {sql: statement} : statement
    const result = await callMain<ExecuteResult>('db.execute', {sql, args, tx})
    return {
      ...result,
      // Rows of libSQL read by index and by column name
      rows: result.rows.map(values => {
        const row = [...values] as Array<unknown> & Record<string, unknown>
        result.columns.forEach((column, index) => {
          row[column] = values[index]
        })
        return row
      })
    }
  }
  return {
    execute,
    async batch(statements: Array<Statement>) {
      const results = []
      for (const statement of statements) results.push(await execute(statement))
      return results
    },
    async transaction() {
      const id = await callMain<number>('db.begin')
      const {execute, batch} = labLibsql(id)
      // A libSQL transaction has no transactions of its own: nested ones
      // are savepoints
      return {
        execute,
        batch,
        commit: () => callMain('db.end', {tx: id, commit: true}),
        rollback: () => callMain('db.end', {tx: id, commit: false}),
        close: () => callMain('db.end', {tx: id, commit: false})
      }
    }
  }
}
