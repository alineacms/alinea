import type {ChangesBatch} from '#/core/source/Change.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import type {GetBlobsOptions, Source} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {type Database, eq, inArray, table} from 'rado'
import * as column from 'rado/universal/columns'
import {SqlTree, type TreeChange} from './SqlTree.js'

const Head = table('alinea_source_head', {
  namespace: column.varchar(undefined, {length: 255}).primaryKey(),
  sha: column.varchar(undefined, {length: 40}).notNull()
})

const Blob = table('alinea_source_blob', {
  sha: column.varchar(undefined, {length: 40}).primaryKey(),
  contents: column.blob().notNull()
})

/** Trusted source storage, not an authorization-filtered browser transport.
 * Owns its connection; callers sharing a connection must serialize access.
 * Immutable trees/blobs are shared, while heads are isolated by source namespace.
 */
export class SqlSource implements Source {
  #db: Database
  #queue: Promise<unknown> = Promise.resolve()

  constructor(
    db: Database,
    readonly namespace: string
  ) {
    if (!namespace) throw new Error('A source namespace is required')
    this.#db = db
  }

  static async createSchema(db: Database): Promise<void> {
    await SqlTree.createSchema(db)
    await db.create(Head, Blob)
    await SqlTree.store(db, ReadonlyTree.EMPTY)
  }

  /** Explicitly create a new namespace; reopening uses the constructor only. */
  static async create(
    db: Database,
    namespace: string,
    sha = ReadonlyTree.EMPTY.sha
  ): Promise<SqlSource> {
    const source = new SqlSource(db, namespace)
    await new SqlTree(db, sha).children()
    await db.insert(Head).values({namespace, sha})
    return source
  }

  #exclusive<T>(run: () => Promise<T>): Promise<T> {
    const task = this.#queue.then(run)
    this.#queue = task.catch(() => {})
    return task
  }

  async #head(db = this.#db): Promise<string> {
    const sha = await db
      .select(Head.sha)
      .from(Head)
      .where(eq(Head.namespace, this.namespace))
      .get()
    if (!sha) throw new Error(`Missing source namespace: ${this.namespace}`)
    return sha
  }

  getSqlTree(): Promise<SqlTree> {
    return this.#exclusive(
      async () => new SqlTree(this.#db, await this.#head())
    )
  }

  async getTree(): Promise<ReadonlyTree> {
    return (await this.getSqlTree()).toTree()
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const tree = await this.getSqlTree()
    return tree.sha === sha ? undefined : tree.toTree()
  }

  async *getBlobs(
    shas: ReadonlyArray<string>,
    options: GetBlobsOptions = {}
  ): AsyncGenerator<[string, Uint8Array]> {
    for (let offset = 0; offset < shas.length; offset += 100) {
      options.signal?.throwIfAborted()
      const batch = shas.slice(offset, offset + 100)
      const rows = await this.#exclusive(async () =>
        this.#db.select().from(Blob).where(inArray(Blob.sha, batch))
      )
      const blobs = new Map(rows.map(row => [row.sha, row.contents]))
      for (const sha of batch) {
        options.signal?.throwIfAborted()
        const contents = blobs.get(sha)
        if (!contents) throw new Error(`Missing source blob: ${sha}`)
        yield [sha, contents.slice()]
      }
    }
  }

  applyChanges(batch: ChangesBatch): Promise<void> {
    return this.#exclusive(async () => {
      await this.#db.transaction(
        async tx => {
          const sha = await this.#head(tx)
          if (sha !== batch.fromSha)
            throw new ShaMismatchError(batch.fromSha, sha)
          const tree = new SqlTree(tx, sha)
          const changes: Array<TreeChange> = []
          for (const change of batch.changes) {
            const actual = await tree.get(change.path)
            const before =
              actual && !actual.directory
                ? {sha: actual.sha, mode: actual.mode}
                : undefined
            if (change.op === 'delete') {
              if (before?.sha !== change.sha)
                throw new Error(`Source changed at ${change.path}`)
              changes.push({path: change.path, before})
              continue
            }
            const contents = change.contents?.slice()
            if (contents && (await hashBlob(contents)) !== change.sha)
              throw new Error(`Invalid source blob hash at ${change.path}`)
            const exists = await tx
              .select(Blob.sha)
              .from(Blob)
              .where(eq(Blob.sha, change.sha))
              .get()
            if (!exists) {
              if (!contents)
                throw new Error(`Missing source contents at ${change.path}`)
              await tx.insert(Blob).values({sha: change.sha, contents})
            }
            changes.push({
              path: change.path,
              before,
              after: {sha: change.sha, mode: before?.mode ?? '100644'}
            })
          }
          const next = await tree.withChanges(changes)
          await tx
            .update(Head)
            .set({sha: next.sha})
            .where(eq(Head.namespace, this.namespace))
        },
        {async: true}
      )
    })
  }
}
