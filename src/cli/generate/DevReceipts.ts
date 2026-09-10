import {DatabaseSync} from 'node:sqlite'
import {mkdir, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {isRecord} from '#/core/util/Objects.js'
import {eq, table} from 'rado'
import * as column from 'rado/universal/columns'
import {nodeDatabase} from '#/database/driver/NodeDatabase.js'
import {HttpError} from '#/core/HttpError.js'
import type {
  CommitRequest,
  CommitTransaction,
  CommitReceipt
} from '#/core/db/CommitRequest.js'
import {decodeMutationPermissions} from '#/core/db/MutationAuthorization.js'
import {sha256Hash} from '#/core/source/Utils.js'

const Receipt = table('dev_receipt', {
  key: column.text().primaryKey(),
  digest: column.text().notNull(),
  sha: column.text().notNull(),
  authorization: column.json<CommitReceipt['authorization']>().notNull(),
  removed: column.json<Array<string>>().notNull(),
  pending: column.integer()
})

/** Private authority metadata, not part of the generated read cache. A prepared
 * row blocks other writes until accepted or explicitly recovered. File changes
 * and the receipt are not claimed to form one atomic filesystem transaction.
 */
export class DevReceipts {
  #sqlite: DatabaseSync
  #db: ReturnType<typeof nodeDatabase>
  #project: string

  private constructor(sqlite: DatabaseSync, project: string) {
    this.#sqlite = sqlite
    this.#db = nodeDatabase(sqlite)
    this.#project = project
  }

  static async open(path: string, project: string): Promise<DevReceipts> {
    await mkdir(dirname(path), {recursive: true, mode: 0o700})
    try {
      await writeFile(join(dirname(path), '.gitignore'), '*\n', {
        flag: 'wx',
        mode: 0o600
      })
    } catch (error) {
      if (!isRecord(error) || error.code !== 'EEXIST') throw error
    }
    const sqlite = new DatabaseSync(path)
    try {
      sqlite.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS dev_receipt (
          key TEXT PRIMARY KEY, digest TEXT NOT NULL, sha TEXT NOT NULL,
          authorization TEXT NOT NULL, removed TEXT NOT NULL, pending INTEGER UNIQUE
        )`)
      return new DevReceipts(sqlite, project)
    } catch (error) {
      sqlite.close()
      throw error
    }
  }

  async #key(
    principal: string | undefined,
    transaction: CommitTransaction
  ): Promise<string> {
    if (
      ![
        this.#project,
        principal,
        transaction.id,
        transaction.namespace,
        transaction.epoch
      ].every(
        value =>
          typeof value === 'string' && value.length > 0 && value.length <= 4096
      ) ||
      !/^[a-f0-9]{64}$/.test(transaction.digest)
    )
      throw new HttpError(400, 'Invalid filesystem transaction')
    return sha256Hash(
      new TextEncoder().encode(
        JSON.stringify([
          this.#project,
          principal,
          transaction.namespace,
          transaction.epoch,
          transaction.id
        ])
      )
    )
  }

  async receipt(
    principal: string,
    transaction: CommitTransaction
  ): Promise<CommitReceipt | undefined> {
    const key = await this.#key(principal, transaction)
    const row = await this.#db
      .select()
      .from(Receipt)
      .where(eq(Receipt.key, key))
      .get()
    if (!row) return
    if (row.digest !== transaction.digest)
      throw new HttpError(409, 'Filesystem transaction ID already used')
    if (row.pending !== null)
      throw new HttpError(
        409,
        'Filesystem transaction interrupted; explicit recovery required'
      )
    return {
      sha: row.sha,
      authorization: decodeMutationPermissions(row.authorization)
    }
  }

  async assertAvailable(): Promise<void> {
    if (
      await this.#db
        .select(Receipt.key)
        .from(Receipt)
        .where(eq(Receipt.pending, 1))
        .get()
    )
      throw new HttpError(
        409,
        'Filesystem transaction interrupted; explicit recovery required'
      )
  }

  /** Recover only a fully materialized target; never replay ambiguous file effects. */
  async recover(
    sha: string,
    removed: (locations: Array<string>) => Promise<boolean>
  ): Promise<void> {
    const row = await this.#db
      .select()
      .from(Receipt)
      .where(eq(Receipt.pending, 1))
      .get()
    if (!row) return
    if (
      row.sha !== sha ||
      !Array.isArray(row.removed) ||
      !row.removed.every(
        location => typeof location === 'string' && location.length > 0
      ) ||
      !(await removed(row.removed))
    )
      throw new HttpError(
        409,
        'Filesystem transaction interrupted; explicit recovery required'
      )
    decodeMutationPermissions(row.authorization)
    await this.accept(row.key)
  }

  async prepare(request: CommitRequest): Promise<string> {
    if (!request.transaction) throw new Error('Missing filesystem transaction')
    const key = await this.#key(request.user?.sub, request.transaction)
    const authorization = decodeMutationPermissions(request.authorization)
    try {
      await this.#db.insert(Receipt).values({
        key,
        digest: request.transaction.digest,
        sha: request.intoSha,
        authorization,
        removed: request.changes.flatMap(change =>
          change.op === 'removeFile' ? [change.location] : []
        ),
        pending: 1
      })
    } catch (error) {
      await this.assertAvailable()
      throw error
    }
    return key
  }

  async accept(key: string): Promise<void> {
    await this.#db
      .update(Receipt)
      .set({pending: null})
      .where(eq(Receipt.key, key))
  }

  close(): void {
    this.#sqlite.close()
  }
}
