import type {Config} from '#/core/Config.js'
import {createRecord} from '#/core/EntryRecord.js'
import {Permission} from '#/core/Role.js'
import {sha256Hash} from '#/core/source/Utils.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {OverlaySource} from '#/core/source/OverlaySource.js'
import {eq, inArray, table, type Database} from 'rado'
import * as column from 'rado/universal/columns'
import {
  EntryIndexTable,
  EntryDataTable,
  entryVersionId
} from '../entry/Schema.js'
import {SqlSource} from '../source/SqlSource.js'
import {openCheckpoint, type CheckpointIdentity} from '../runtime/Checkpoint.js'
import {reconcileDatabase} from '../runtime/ReconcileDatabase.js'
import {
  applyFieldOperations,
  canonicalJson,
  pointerSegments,
  snapshotTransaction,
  type FieldTransaction
} from '../replica/Operations.js'
import {evaluateRolePolicy} from './Policy.js'

export interface FieldCommitResult {
  transactionId: string
  revision: string
}

/** Successful receipts also pin the before/after source trees for later delivery. */
export const FieldReceiptTable = table('alinea_field_receipt', {
  id: column.varchar(undefined, {length: 64}).primaryKey(),
  digest: column.varchar(undefined, {length: 64}).notNull(),
  fromRevision: column.varchar(undefined, {length: 40}).notNull(),
  result: column.json<FieldCommitResult>().notNull()
})

const structuralFields = ['path', 'metadata', 'aliases']
const structuralColumns = [
  'id',
  'locale',
  'versionStatus',
  'status',
  'type',
  'workspace',
  'root',
  'sourceRoot',
  'parentId',
  'parents',
  'level',
  'index',
  'path',
  'url',
  'active',
  'main',
  'visible',
  'seeded'
] as const

/** SQL-authoritative content writes only. Never attach this to a dev cache and
 * claim Git durability. The caller owns connection serialization and supplies
 * the principal/roles from a verified session, not client-compiled permissions.
 * Routing/structural changes require their dedicated mutation stage.
 */
export class SqlFieldWriter {
  #db: Database
  #config: Config
  #identity: CheckpointIdentity
  constructor(config: Config, db: Database, identity: CheckpointIdentity) {
    this.#config = config
    this.#db = db
    this.#identity = {...identity}
  }

  static async createSchema(db: Database): Promise<void> {
    await db.create(FieldReceiptTable)
  }

  async commit(
    principal: string,
    roles: ReadonlyArray<string>,
    transaction: FieldTransaction
  ): Promise<FieldCommitResult> {
    if (typeof principal !== 'string' || !principal)
      throw new Error('A verified principal is required')
    const request = snapshotTransaction(transaction)
    const roleNames = [...roles]
    const binding = this.#identity
    const encode = (value: unknown) =>
      new TextEncoder().encode(canonicalJson(value))
    const id = await sha256Hash(
      encode([
        'alinea.field.receipt.v1',
        binding.project,
        binding.namespace,
        binding.epoch,
        principal,
        request.id
      ])
    )
    const digest = await sha256Hash(encode(request))
    return this.#db.transaction(
      async tx => {
        const {runtime, descriptor} = await openCheckpoint(
          this.#config,
          tx,
          binding
        )
        const policy = await evaluateRolePolicy(
          this.#config,
          runtime,
          roleNames
        )
        const ids = [
          ...new Set(request.operations.map(operation => operation.recordId))
        ]
        const rows = []
        for (let offset = 0; offset < ids.length; offset += 100)
          rows.push(
            ...(await tx
              .select({entry: EntryIndexTable, payload: EntryDataTable})
              .from(EntryIndexTable)
              .innerJoin(
                EntryDataTable,
                eq(EntryIndexTable.versionId, EntryDataTable.versionId)
              )
              .where(
                inArray(
                  EntryIndexTable.versionId,
                  ids.slice(offset, offset + 100)
                )
              ))
          )
        const entries = new Map(rows.map(row => [row.entry.versionId, row]))
        const authorize = (recordId: string, field: string) => {
          const row = entries.get(recordId)
          if (
            !row ||
            structuralFields.includes(field) ||
            field.startsWith('_') ||
            !Object.hasOwn(this.#config.schema[row.entry.type] ?? {}, field)
          )
            return false
          const resource = {...row.entry, field}
          return (
            policy.check(Permission.Read | Permission.Update, resource) &&
            policy.check(Permission.Read | Permission.Update, row.entry) &&
            (row.entry.versionStatus !== 'published' ||
              policy.check(Permission.Publish, row.entry))
          )
        }
        // Reauthorize even a successful retry; a receipt never bypasses revocation.
        for (const operation of request.operations)
          if (
            !authorize(operation.recordId, pointerSegments(operation.path)[0])
          )
            throw new Error('Field mutation is not authorized')
        const receipt = await tx
          .select()
          .from(FieldReceiptTable)
          .where(eq(FieldReceiptTable.id, id))
          .get()
        if (receipt) {
          if (receipt.digest !== digest)
            throw new Error(
              'Transaction ID was reused with a different request'
            )
          return receipt.result
        }
        const changed = await applyFieldOperations(
          request,
          new Map(rows.map(row => [row.entry.versionId, row.payload.data])),
          authorize
        )
        const source = new SqlSource(tx, binding.namespace)
        const overlay = await OverlaySource.create(source)
        const changes = []
        for (const [versionId, data] of changed) {
          const row = entries.get(versionId)!
          if (canonicalJson(data) === canonicalJson(row.payload.data)) continue
          const path = row.payload.source?.filePath
          if (!path) throw new Error('Writable entry source path is missing')
          const contents = new TextEncoder().encode(
            JSON.stringify(
              createRecord({...row.entry, data}, row.entry.versionStatus),
              null,
              2
            )
          )
          const sha = await hashBlob(contents)
          const before = (await source.getSqlTree()).sha
          if (before !== descriptor.sourceSha)
            throw new Error('Mutation source revision changed')
          const old = (await overlay.getTree()).get(path)
          if (!old || old.type === 'tree')
            throw new Error('Writable entry source file is missing')
          changes.push(
            {op: 'delete' as const, path, sha: old.sha},
            {op: 'add' as const, path, sha, contents}
          )
        }
        await overlay.applyChanges({fromSha: descriptor.sourceSha, changes})
        const before = await runtime.indexSnapshot()
        const result = await reconcileDatabase(
          this.#config,
          tx,
          overlay,
          binding
        )
        const after = await (
          await openCheckpoint(this.#config, tx, binding)
        ).runtime.indexSnapshot()
        const previous = new Map(
          before.entries.map(row => [
            entryVersionId(
              row.entry.id,
              row.entry.locale,
              row.entry.versionStatus
            ),
            row.entry
          ])
        )
        if (after.entries.length !== before.entries.length)
          throw new Error('Field write requires structural mutation handling')
        for (const row of after.entries) {
          const old = previous.get(
            entryVersionId(
              row.entry.id,
              row.entry.locale,
              row.entry.versionStatus
            )
          )
          if (
            !old ||
            structuralColumns.some(
              key => JSON.stringify(old[key]) !== JSON.stringify(row.entry[key])
            )
          )
            throw new Error('Field write requires structural mutation handling')
        }
        const committed = {transactionId: request.id, revision: result.revision}
        await tx.insert(FieldReceiptTable).values({
          id,
          digest,
          fromRevision: descriptor.sourceSha,
          result: committed
        })
        return committed
      },
      {async: true}
    )
  }
}
