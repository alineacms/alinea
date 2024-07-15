import {Connection} from 'alinea/core/Connection'
import {Draft} from 'alinea/core/Draft'

export interface DraftTransport {
  entryId: string
  commitHash: string
  fileHash: string
  draft: string
}

export interface Drafts {
  getDraft(entryId: string, ctx: Connection.Context): Promise<Draft | undefined>
  storeDraft(draft: Draft, ctx: Connection.Context): Promise<void>
}
