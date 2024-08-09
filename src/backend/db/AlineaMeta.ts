import {InferSelectModel, table} from 'rado'
import * as column from 'rado/universal/columns'

export const AlineaMeta = table('AlineaMeta', {
  commitHash: column.text(),
  contentHash: column.text(),
  modifiedAt: column.integer()
})

export type AlineaMeta = InferSelectModel<typeof AlineaMeta>
