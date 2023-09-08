import {Connection, User} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'

export interface Revision {
  revisionId: string
  createdAt: number
  user?: User
  description?: string
}

export interface EntryFile {
  workspace: string
  root: string
  filePath: string
}

export interface History {
  revisions(file: EntryFile, ctx: Connection.Context): Promise<Array<Revision>>
  revisionData(
    file: EntryFile,
    revisionId: string,
    ctx: Connection.Context
  ): Promise<EntryRecord>
}
