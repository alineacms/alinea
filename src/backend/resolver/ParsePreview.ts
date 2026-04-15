import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {Entry} from '#/core.js'
import type {LocalDB} from '#/core/db/LocalDB.js'
import {createRecord, parseRecord} from '#/core/EntryRecord.js'
import type {PreviewRequest} from '#/core/Preview.js'
import {applyFilePatch} from '#/core/source/FilePatch.js'
import {createEntryRow} from '#/core/util/EntryRows.js'
import {decodePreviewPayload} from '#/preview/PreviewPayload.js'

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
        JsonLoader.format(
          local.config.schema,
          createRecord(entry, entry.status)
        )
      )
      let updatedText: string
      try {
        updatedText = await applyFilePatch(baseText, payload.patch)
      } catch {
        return
      }
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
