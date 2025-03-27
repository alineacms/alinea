import {Entry} from 'alinea/core'
import {parseYDoc} from 'alinea/core/Doc'
import {type Draft, type DraftKey, formatDraftKey} from 'alinea/core/Draft'
import type {PreviewRequest} from 'alinea/core/Preview'
import type {LocalDB} from 'alinea/core/db/LocalDB.js'
import {decodePreviewPayload} from 'alinea/preview/PreviewPayload'
import * as Y from 'yjs'

export function createPreviewParser(local: LocalDB) {
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
      if (update.contentHash !== local.sha) {
        await sync()
        if (update.contentHash !== local.sha) return
      }
      const entry = await local.first({
        select: Entry,
        id: update.entryId,
        locale: update.locale,
        status: 'preferDraft'
      })
      if (!entry) return
      const key = formatDraftKey(entry)
      const cachedDraft = await drafts.get(key)
      let currentDraft: Draft | undefined
      if (cachedDraft?.contentHash === local.sha) {
        currentDraft = cachedDraft.draft
      } else {
        try {
          const pending = getDraft(key)
          drafts.set(
            key,
            pending.then(draft => ({contentHash: local.sha, draft}))
          )
          currentDraft = await pending
        } catch (error) {
          console.warn('> could not fetch draft', error)
        }
      }
      const apply = currentDraft
        ? Y.mergeUpdatesV2([currentDraft.draft, update.update])
        : update.update
      const type = local.config.schema[entry.type]
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
