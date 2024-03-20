import {Connection} from 'alinea/core/Connection'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {User} from 'alinea/core/User'

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
