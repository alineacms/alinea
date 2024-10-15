import {Entry} from 'alinea/core'
import {parseYDoc} from 'alinea/core/Doc'
import {Draft} from 'alinea/core/Draft'
import {PreviewRequest} from 'alinea/core/Preview'
import {decodePreviewPayload} from 'alinea/preview/PreviewPayload'
import * as Y from 'yjs'
import {Database} from '../Database.js'

export function createPreviewParser(db: Database) {
  const drafts = new Map<
    string,
    Promise<{contentHash: string; draft?: Draft}>
  >()
  return {
    async parse(
      preview: PreviewRequest,
      sync: () => Promise<unknown>,
      getDraft: (entryId: string) => Promise<Draft | undefined>
    ): Promise<PreviewRequest | undefined> {
      if (!(preview && 'payload' in preview)) return preview
      const update = await decodePreviewPayload(preview.payload)
      let meta = await db.meta()
      if (update.contentHash !== meta.contentHash) {
        await sync()
        meta = await db.meta()
      }
      const entry = await db.resolver.resolve({
        first: true,
        select: Entry,
        filter: {_id: update.entryId},
        status: 'preferDraft'
      })
      if (!entry) return
      const cachedDraft = await drafts.get(update.entryId)
      let currentDraft: Draft | undefined
      if (cachedDraft?.contentHash === meta.contentHash) {
        currentDraft = cachedDraft.draft
      } else {
        try {
          const pending = getDraft(update.entryId)
          drafts.set(
            update.entryId,
            pending.then(draft => ({contentHash: meta.contentHash, draft}))
          )
          currentDraft = await pending
        } catch (error) {
          console.warn('> could not fetch draft', error)
        }
      }
      const apply = currentDraft
        ? Y.mergeUpdatesV2([currentDraft.draft, update.update])
        : update.update
      const type = db.config.schema[entry.type]
      if (!type) return
      const doc = new Y.Doc()
      Y.applyUpdateV2(doc, apply)
      const entryData = parseYDoc(type, doc)
      return {entry: {...entry, ...entryData, path: entry.path}}
    },
    setDraft(entryId: string, input: {contentHash: string; draft?: Draft}) {
      drafts.set(entryId, Promise.resolve(input))
    }
  }
}
