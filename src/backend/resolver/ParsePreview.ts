import {Entry} from 'alinea/core'
import {DOC_KEY, parseYDoc} from 'alinea/core/Doc'
import type {PreviewRequest} from 'alinea/core/Preview'
import {Type} from 'alinea/core/Type'
import type {LocalDB} from 'alinea/core/db/LocalDB'
import {decodePreviewPayload} from 'alinea/preview/PreviewPayload'
import * as Y from 'yjs'

export function createPreviewParser(local: LocalDB) {
  return {
    async parse(
      preview: PreviewRequest,
      sync: () => Promise<unknown>
    ): Promise<PreviewRequest | undefined> {
      if (!(preview && 'payload' in preview)) return preview
      const update = await decodePreviewPayload(preview.payload)
      let entry = await local.first({
        select: Entry,
        id: update.entryId,
        locale: update.locale,
        status: 'preferDraft'
      })
      if (!entry) return
      if (update.contentHash !== entry.fileHash) {
        await sync()
        entry = await local.first({
          select: Entry,
          id: update.entryId,
          locale: update.locale,
          status: 'preferDraft'
        })
        if (!entry) return
        if (update.contentHash !== entry.fileHash) return
      }
      const type = local.config.schema[entry.type]
      if (!type) return
      const doc = new Y.Doc()
      const clientID = doc.clientID
      doc.clientID = 1
      Type.shape(type).applyY(entry.data, doc, DOC_KEY)
      doc.clientID = clientID
      Y.applyUpdate(doc, update.update)
      const entryData = parseYDoc(type, doc)
      return {entry: {...entry, ...entryData, path: entry.path}}
    }
  }
}
