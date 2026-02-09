import {JsonLoader} from 'alinea/backend/loader/JsonLoader'
import {Entry} from 'alinea/core'
import {createRecord, parseRecord} from 'alinea/core/EntryRecord'
import type {PreviewRequest} from 'alinea/core/Preview'
import type {LocalDB} from 'alinea/core/db/LocalDB'
import {applyFilePatch} from 'alinea/core/source/FilePatch'
import {createEntryRow} from 'alinea/core/util/EntryRows'
import {decodePreviewPayload} from 'alinea/preview/PreviewPayload'
const decoder = new TextDecoder()

export function createPreviewParser(local: LocalDB) {
  return {
    async parse(
      preview: PreviewRequest,
      sync: () => Promise<unknown>
    ): Promise<PreviewRequest | undefined> {
      if (!(preview && 'payload' in preview)) return preview
      const payload = await decodePreviewPayload(preview.payload)
      if (local.sha !== payload.contentHash) {
        await sync()
        if (local.sha !== payload.contentHash) return
      }
      const entry = await local.first({
        select: Entry,
        id: payload.entryId,
        locale: payload.locale,
        status: 'preferDraft'
      })
      if (!entry) return
      const baseText = decoder.decode(
        JsonLoader.format(local.config.schema, createRecord(entry, entry.status))
      )
      const updatedText = await applyFilePatch(baseText, payload.patch)
      const {data} = parseRecord(JSON.parse(updatedText))
      const {rowHash: _rowHash, fileHash: _fileHash, ...withoutHashes} = entry
      const patched = await createEntryRow(
        local.config,
        {
          ...withoutHashes,
          title: data.title as string,
          data,
          path: entry.path
        },
        entry.status
      )
      return {entry: patched}
    }
  }
}
