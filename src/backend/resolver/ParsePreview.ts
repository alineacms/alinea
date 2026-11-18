import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {Entry} from '#/core/Entry.js'
import {
  createRecord,
  type EntryRecord,
  parseRecord,
  recordJson
} from '#/core/EntryRecord.js'
import type {Graph} from '#/core/Graph.js'
import type {
  PreviewDelta,
  PreviewRequest,
  PreviewUpdate
} from '#/core/Preview.js'
import {applyFilePatch} from '#/core/source/FilePatch.js'
import {trace} from '#/core/Trace.js'
import {createEntryRow} from '#/core/util/EntryRows.js'
import {decodePreviewPayload} from '#/preview/PreviewPayload.js'

const decoder = new TextDecoder()

export interface DecodedEntryPreview {
  entry: Entry
}

export type DecodedPreviewRequest =
  | PreviewUpdate
  | PreviewDelta
  | DecodedEntryPreview

export async function decodePreviewRequest(
  preview: PreviewRequest
): Promise<DecodedPreviewRequest> {
  if ('entry' in preview) return preview
  return decodePreviewPayload(preview.payload)
}

/**
 * The entry a preview shows. A delta applies to the row it was made from,
 * so a server whose row is that one previews without syncing; otherwise, as
 * for a patch, the server syncs to the content the dashboard previews on
 * first.
 */
export async function resolvePreview(
  local: Graph & {sha: string | Promise<string>},
  preview: DecodedPreviewRequest,
  sync: () => Promise<unknown>
): Promise<PreviewRequest | undefined> {
  if ('entry' in preview) return preview
  if ('version' in preview) {
    const applied = await applyPreview(local, preview)
    if (applied) return applied
  }
  if ((await local.sha) !== preview.contentHash) await sync()
  return applyPreview(local, preview)
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
    const record =
      'version' in preview
        ? await deltaRecord(entry, preview)
        : entry && (await patchedRecord(local, entry, preview))
    if (!entry || !record) return
    const {data} = parseRecord(record)
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

async function deltaRecord(
  entry: Entry | null,
  preview: PreviewDelta
): Promise<EntryRecord | undefined> {
  if (entry && entry.fileHash === preview.fileHash) {
    try {
      return JSON.parse(await applyFilePatch(recordJson(entry), preview.delta))
    } catch {}
  }
  return preview.record
}

async function patchedRecord(
  local: Graph,
  entry: Entry,
  preview: PreviewUpdate
): Promise<EntryRecord | undefined> {
  const baseText = decoder.decode(
    JsonLoader.format(local.config.schema, createRecord(entry, entry.status))
  )
  try {
    return JSON.parse(await applyFilePatch(baseText, preview.patch))
  } catch {
    return undefined
  }
}
