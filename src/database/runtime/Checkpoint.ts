import type {Config} from '#/core/Config.js'
import {type Database, eq, table} from 'rado'
import * as column from 'rado/universal/columns'
import {SqlSource} from '../source/SqlSource.js'
import {EntryRuntime} from './EntryRuntime.js'
import type {FrameBinding} from '../replica/Frame.js'

export const checkpointFormat = 10
export const CheckpointTable = table('alinea_checkpoint', {
  id: column.integer().primaryKey(),
  format: column.integer().notNull(),
  project: column.text().notNull(),
  epoch: column.text().notNull(),
  schemaId: column.text().notNull(),
  configId: column.text().notNull(),
  namespace: column.text().notNull(),
  releaseId: column.text().notNull(),
  sourceSha: column.varchar(undefined, {length: 40}).notNull()
})

export interface CheckpointIdentity extends FrameBinding {
  /** Build-system fingerprint including schema, configuration and normalizer. */
  configId: string
  namespace: string
  releaseId: string
}

/** Open a trusted, immutable checkpoint using constant-size descriptor reads.
 * The caller owns the connection and opens the packaged file read-only.
 */
export async function openCheckpoint(
  config: Config,
  db: Database,
  expected: CheckpointIdentity
) {
  const descriptor = await db
    .select()
    .from(CheckpointTable)
    .where(eq(CheckpointTable.id, 1))
    .get()
  if (!descriptor || descriptor.format !== checkpointFormat)
    throw new Error('Unsupported or incomplete database checkpoint')
  for (const key of [
    'project',
    'epoch',
    'schemaId',
    'configId',
    'namespace',
    'releaseId'
  ] as const)
    if (descriptor[key] !== expected[key])
      throw new Error(`Checkpoint ${key} mismatch`)
  const source = new SqlSource(db, descriptor.namespace)
  const tree = await source.getSqlTree()
  const runtime = new EntryRuntime(config, db, {
    async includedAtBuild(filePath) {
      return Boolean(await tree.get(filePath))
    }
  })
  if (
    tree.sha !== descriptor.sourceSha ||
    (await runtime.getRevision()) !== descriptor.sourceSha
  )
    throw new Error('Checkpoint revision mismatch')
  return {runtime, descriptor}
}
