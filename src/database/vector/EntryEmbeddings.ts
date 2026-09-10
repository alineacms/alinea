import {and, eq, type Database} from 'rado'
import type {Config} from '#/core/Config.js'
import {
  EntryDataTable,
  entryVersionId,
  type EntrySource
} from '../entry/Schema.js'
import type {EntryReplacement} from '../runtime/EntryRuntime.js'
import {validateEmbeddingSpace, type EmbeddingJob} from './Embedding.js'
import {prepareEmbeddingInput} from './EmbeddingInput.js'
import {EmbeddingStore} from './EmbeddingStore.js'

function textInput(source?: EntrySource) {
  const text = source?.searchableText
  if (!text?.trim()) return
  return {mediaType: 'text/plain', bytes: new TextEncoder().encode(text)}
}

/** Pure text preparation under the caller's exclusively owned source transaction.
 * No providers, media downloads or external extraction run on this path.
 */
export async function prepareEntryEmbeddings(
  config: Config,
  db: Database,
  rows: ReadonlyArray<EntryReplacement>
): Promise<void> {
  const slots = Object.entries(structuredClone(config.embeddings ?? {}))
  if (!slots.length) return
  const store = new EmbeddingStore(db)
  for (const [slot, definition] of slots) {
    if (!slot || slot.length > 1024 || definition.source !== 'searchableText')
      throw new Error('Unsupported entry embedding definition')
    validateEmbeddingSpace(definition.space)
  }
  for (const row of rows) {
    if (!row.payloadId) continue
    if (!row.data)
      throw new Error('Embedding preparation requires complete entry data')
    const input = textInput(row.source)
    const chunks = input
      ? [
          {
            chunk: 'text',
            sourceHash: (await prepareEmbeddingInput(input)).hash
          }
        ]
      : []
    for (const [slot, definition] of slots) {
      await store.publishOwner(
        {
          owner: {
            versionId: entryVersionId(
              row.entry.id,
              row.entry.locale,
              row.entry.versionStatus
            ),
            kind: 'entry'
          },
          ownerPayloadId: row.payloadId,
          slot,
          space: definition.space,
          chunks
        },
        await store.revision()
      )
    }
  }
}

/** Trusted runner loader. Use an exclusively owned snapshot/serialization boundary.
 * Reconstructs bytes from the exact durable owner payload, never a mutable URL.
 */
export async function loadEntryEmbeddingInput(db: Database, job: EmbeddingJob) {
  if (job.target.owner.kind !== 'entry' || job.target.chunk !== 'text') return
  const row = await db
    .select({source: EntryDataTable.source})
    .from(EntryDataTable)
    .where(
      and(
        eq(EntryDataTable.versionId, job.target.owner.versionId),
        eq(EntryDataTable.payloadId, job.target.ownerPayloadId)
      )
    )
    .get()
  return row ? textInput(row.source ?? undefined) : undefined
}
