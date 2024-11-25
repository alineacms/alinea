import {Drafts, RequestContext} from 'alinea/backend/Backend'
import {Draft} from 'alinea/core/Draft'

export class MemoryDrafts implements Drafts {
  drafts = new Map<string, Draft>()

  async get(ctx: RequestContext, entryId: string): Promise<Draft | undefined> {
    return this.drafts.get(entryId)
  }

  async store(ctx: RequestContext, draft: Draft): Promise<void> {
    this.drafts.set(draft.entryId, draft)
  }
}
