import {Connection, User} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'

export interface Revision {
  revisionId: string
  createdAt: number
  user?: User
  description?: string
}

export interface History {
  revisions(filePath: string, ctx: Connection.Context): Promise<Array<Revision>>
  revisionData(
    revisionId: string,
    ctx: Connection.Context
  ): Promise<EntryRecord>
}
