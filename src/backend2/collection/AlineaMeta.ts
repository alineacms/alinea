import {column, table} from 'rado'

class AlineaMetaTable {
  contentHash = column.string
  modifiedAt = column.number
}

export type AlineaMeta = table<AlineaMetaTable>
export const AlineaMeta = table({AlineaMeta: AlineaMetaTable})
