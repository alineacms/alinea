import {eq, gt, isNull, table, type Database} from 'rado'
import * as column from 'rado/universal/columns'
import {sha256Hash} from '#/core/source/Utils.js'
import {EntryDataTable, EntryIndexTable} from '../entry/Schema.js'
import {
  createFrameKey,
  encryptFrame,
  frameIdentityKey,
  validateFrameDescriptor,
  type FrameIdentity,
  type FrameBinding,
  type FrameDescriptor,
  type FrameGrant
} from '../replica/Frame.js'

interface StoredDescriptor extends Omit<FrameDescriptor, 'nonce'> {
  nonce: Array<number>
}

/** This table is private: keys must never be included in public bundle exports. */
export const FrameTable = table('alinea_release_frame', {
  id: column.varchar(undefined, {length: 64}).primaryKey(),
  descriptor: column.json<StoredDescriptor>().notNull(),
  key: column.blob().notNull(),
  ciphertext: column.blob().notNull()
})

/** Private manifest: public files contain ciphertext, never this entry mapping. */
export const FrameLocationTable = table('alinea_release_frame_location', {
  id: column.varchar(undefined, {length: 64}).primaryKey(),
  bundle: column.varchar(undefined, {length: 64}).notNull(),
  offset: column.integer().notNull()
})

function storageId(identity: FrameIdentity): Promise<string> {
  return sha256Hash(new TextEncoder().encode(frameIdentityKey(identity)))
}

export class FrameStore {
  #db: Database

  constructor(db: Database) {
    this.#db = db
  }

  static async createSchema(db: Database): Promise<void> {
    await db.create(FrameTable, FrameLocationTable)
  }

  /** Trusted build deduplication; do not expose private frame membership. */
  async has(identity: FrameIdentity): Promise<boolean> {
    const id = await this.#db
      .select(FrameTable.id)
      .from(FrameTable)
      .where(eq(FrameTable.id, await storageId(identity)))
      .get()
    return id != null
  }

  async location(
    identity: FrameIdentity
  ): Promise<{bundle: string; offset: number}> {
    const row = await this.#db
      .select({
        bundle: FrameLocationTable.bundle,
        offset: FrameLocationTable.offset
      })
      .from(FrameLocationTable)
      .where(eq(FrameLocationTable.id, await storageId(identity)))
      .get()
    if (!row) throw new Error('Release frame has not been published')
    return row
  }

  /** Append one immutable frame. Reusing its identity is an error, never a key overwrite. */
  async put(identity: FrameIdentity, contents: Uint8Array): Promise<void> {
    const key = createFrameKey()
    const {descriptor, ciphertext} = await encryptFrame(identity, contents, key)
    await this.#db.insert(FrameTable).values({
      id: await storageId(descriptor),
      descriptor: {...descriptor, nonce: Array.from(descriptor.nonce)},
      key,
      ciphertext
    })
  }

  /** Trusted lookup only. Callers must authorize before exposing this result. */
  async grant(identity: FrameIdentity): Promise<FrameGrant> {
    const row = await this.#db
      .select({descriptor: FrameTable.descriptor, key: FrameTable.key})
      .from(FrameTable)
      .where(eq(FrameTable.id, await storageId(identity)))
      .get()
    if (!row) throw new Error('Missing release payload frame')
    const descriptor = {
      ...row.descriptor,
      nonce: new Uint8Array(row.descriptor.nonce)
    }
    validateFrameDescriptor(identity, descriptor)
    if (row.key.byteLength !== 32) throw new Error('Invalid stored frame key')
    return {descriptor, key: row.key.slice()}
  }

  /** Ciphertext may be published; this method never selects private key material. */
  async ciphertext(identity: FrameIdentity): Promise<Uint8Array> {
    const contents = await this.#db
      .select(FrameTable.ciphertext)
      .from(FrameTable)
      .where(eq(FrameTable.id, await storageId(identity)))
      .get()
    if (!contents) throw new Error('Missing release payload frame')
    return contents.slice()
  }
}

/** Build from already-normalized SQL rows, with bounded batches and no source reparsing. */
export async function buildFrames(
  db: Database,
  binding: FrameBinding
): Promise<void> {
  await FrameStore.createSchema(db)
  await db.transaction(
    async tx => {
      const missing = await tx
        .select(EntryIndexTable.versionId)
        .from(EntryIndexTable)
        .leftJoin(
          EntryDataTable,
          eq(EntryDataTable.versionId, EntryIndexTable.versionId)
        )
        .where(isNull(EntryDataTable.versionId))
        .limit(1)
        .get()
      if (missing != null)
        throw new Error('Release frame generation requires complete entry data')
      const store = new FrameStore(tx)
      let after: string | undefined
      for (;;) {
        const rows = await tx
          .select()
          .from(EntryDataTable)
          .where(
            after === undefined
              ? undefined
              : gt(EntryDataTable.versionId, after)
          )
          .orderBy(EntryDataTable.versionId)
          .limit(100)
        if (!rows.length) break
        for (const row of rows)
          await store.put(
            {
              ...binding,
              versionId: row.versionId,
              payloadId: row.payloadId,
              kind: 'data'
            },
            new TextEncoder().encode(
              JSON.stringify({data: row.data, source: row.source ?? undefined})
            )
          )
        after = rows.at(-1)!.versionId
      }
    },
    {async: true}
  )
}
