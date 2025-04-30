import type {DraftsApi} from 'alinea/core/Connection'
import type {Draft} from 'alinea/core/Draft'

export class MemoryDrafts implements DraftsApi {
  drafts = new Map<string, Draft>()

  async getDraft(entryId: string): Promise<Draft | undefined> {
    return this.drafts.get(entryId)
  }

  async storeDraft(draft: Draft): Promise<void> {
    this.drafts.set(draft.entryId, draft)
  }
}
