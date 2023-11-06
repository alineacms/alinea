import {Connection, Draft} from 'alinea/core'

export interface DraftTransport {
  entryId: string
  fileHash: string
  draft: string
}

export interface Drafts {
  getDraft(entryId: string, ctx: Connection.Context): Promise<Draft | undefined>
  storeDraft(draft: Draft, ctx: Connection.Context): Promise<void>
}
