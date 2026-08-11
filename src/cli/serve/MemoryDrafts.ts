import type {DraftsApi} from '#/core/Connection.js'
import type {Draft} from '#/core/Draft.js'

export class MemoryDrafts implements DraftsApi {
  drafts = new Map<string, Draft>()

  async getDraft(entryId: string): Promise<Draft | undefined> {
    return this.drafts.get(entryId)
  }

  async storeDraft(draft: Draft): Promise<void> {
    this.drafts.set(draft.entryId, draft)
  }
}
