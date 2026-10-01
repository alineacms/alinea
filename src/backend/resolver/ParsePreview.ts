import {Entry} from '#/core/Entry.js'
import {createRecord, parseRecord} from '#/core/EntryRecord.js'
import type {PreviewRequest, PreviewUpdate} from '#/core/Preview.js'
import {applyFilePatch} from '#/core/source/FilePatch.js'
import {trace} from '#/core/Trace.js'
import {createEntryRow} from '#/core/util/EntryRows.js'
import {decodePreviewPayload} from '#/preview/PreviewPayload.js'
import type {Graph} from '#/core/Graph.js'
import {loaderFor} from '#/core/Loader.js'

const decoder = new TextDecoder()
const encoder = new TextEncoder()

export interface DecodedEntryPreview {
  entry: Entry
}

export type DecodedPreviewRequest = PreviewUpdate | DecodedEntryPreview

export async function decodePreviewRequest(
  preview: PreviewRequest
): Promise<DecodedPreviewRequest> {
  if ('entry' in preview) return preview
  return decodePreviewPayload(preview.payload)
}

export async function applyPreview(
  local: Graph,
  preview: DecodedPreviewRequest
): Promise<PreviewRequest | undefined> {
  if ('entry' in preview) return preview
  const span = trace(local.config, 'alinea.preview.apply')
  return span(async () => {
    const entry = await local.first({
      select: Entry,
      id: preview.entryId,
      locale: preview.locale,
      status: 'preferDraft'
    })
    if (!entry) return
    const {schema} = local.config
    const loader = loaderFor(entry.filePath)
    const baseText = decoder.decode(
      loader.format(schema, createRecord(entry, entry.status))
    )
    let updatedText: string
    try {
      updatedText = await applyFilePatch(baseText, preview.patch)
    } catch {
      return
    }
    const {data} = parseRecord(
      loader.parse(schema, encoder.encode(updatedText))
    )
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
  })
}
