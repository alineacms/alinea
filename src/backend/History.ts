import {Connection, User} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'

export interface Revision {
  revisionId: string
  createdAt: number
  user?: User
  description?: string
}

export interface History {
  revisions(file: string, ctx: Connection.Context): Promise<Array<Revision>>
  revisionData(
    file: string,
    revisionId: string,
    ctx: Connection.Context
  ): Promise<EntryRecord>
}
