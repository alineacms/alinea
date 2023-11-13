import {column, table} from 'rado'

class AlineaMetaTable {
  commitHash = column.string
  contentHash = column.string
  modifiedAt = column.number
}

export type AlineaMeta = table<AlineaMetaTable>
export const AlineaMeta = table({AlineaMeta: AlineaMetaTable})
