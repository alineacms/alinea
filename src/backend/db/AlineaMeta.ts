import {InferSelectModel, table} from 'rado'
import * as column from 'rado/universal/columns'

export const AlineaMeta = table('AlineaMeta', {
  commitHash: column.text().notNull(),
  contentHash: column.text().notNull(),
  modifiedAt: column.integer().notNull()
})

export type AlineaMeta = InferSelectModel<typeof AlineaMeta>
