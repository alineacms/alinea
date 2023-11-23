import {Drafts} from 'alinea/backend/Drafts'
import {Draft} from 'alinea/core'

export class MemoryDrafts implements Drafts {
  drafts = new Map<string, Draft>()

  async getDraft(entryId: string): Promise<Draft | undefined> {
    return this.drafts.get(entryId)
  }

  async storeDraft(draft: Draft): Promise<void> {
    this.drafts.set(draft.entryId, draft)
  }
}
