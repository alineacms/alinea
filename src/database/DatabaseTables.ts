import type {Tree} from '#/core/source/Tree.js'
import {table} from 'rado'
import * as column from 'rado/universal/columns'

export const DatabaseStateColumns = {
  id: column.integer().primaryKey(),
  revision: column.text().notNull(),
  /** Merkle tree matching the indexed source revision. */
  tree: column.json<Tree>()
}

export const DatabaseStateTable = table(
  'alinea_database_state',
  DatabaseStateColumns
)

export const DatabaseMetadataColumns = {
  id: column.integer().primaryKey(),
  configFingerprint: column.text().notNull()
}

export const DatabaseMetadataTable = table(
  'alinea_database_metadata',
  DatabaseMetadataColumns
)
