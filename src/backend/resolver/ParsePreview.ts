import {Entry} from 'alinea/core'
import {parseYDoc} from 'alinea/core/Doc'
import {type Draft, type DraftKey, formatDraftKey} from 'alinea/core/Draft'
import type {PreviewRequest} from 'alinea/core/Preview'
import {decodePreviewPayload} from 'alinea/preview/PreviewPayload'
import * as Y from 'yjs'
import type {Database} from '../Database.js'

export function createPreviewParser(db: Database) {
  const drafts = new Map<
    DraftKey,
    Promise<{contentHash: string; draft?: Draft}>
  >()
  return {
    async parse(
      preview: PreviewRequest,
      sync: () => Promise<unknown>,
      getDraft: (draftKey: DraftKey) => Promise<Draft | undefined>
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
        id: update.entryId,
        locale: update.locale,
        status: 'preferDraft'
      })
      if (!entry) return
      const key = formatDraftKey(entry)
      const cachedDraft = await drafts.get(key)
      let currentDraft: Draft | undefined
      if (cachedDraft?.contentHash === meta.contentHash) {
        currentDraft = cachedDraft.draft
      } else {
        try {
          const pending = getDraft(key)
          drafts.set(
            key,
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
    setDraft(key: DraftKey, input: {contentHash: string; draft?: Draft}) {
      drafts.set(key, Promise.resolve(input))
    }
  }
}
