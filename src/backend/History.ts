import {Connection, User} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'

export interface Revision {
  ref: string
  createdAt: number
  file: string
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
