import {PreviewUpdate} from 'alinea/backend/Resolver'
import {base64url} from 'alinea/core/util/Encoding'
import {zlibSync} from 'fflate'
import {useAtomValue} from 'jotai'
import {useEffect, useState} from 'react'
import {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
import {BrowserPreview} from '../preview/BrowserPreview.js'

export interface EntryPreviewProps {
  editor: EntryEditor
  preview: string
}

export interface LivePreview {
  preview(update: PreviewUpdate): void
}

export function EntryPreview({editor, preview}: EntryPreviewProps) {
  const selectedPhase = useAtomValue(editor.selectedPhase) ?? editor.activePhase
  const previewSearch = `?token=${editor.previewToken}&entryId=${editor.entryId}&realm=${selectedPhase}`
  const base = new URL(preview, location.href)
  const url = new URL(previewSearch, base)
  const [api, setApi] = useState<LivePreview | undefined>(undefined)
  const yUpdate = useAtomValue(editor.yUpdate)
  useEffect(() => {
    if (!api) return
    const compressed = zlibSync(yUpdate, {level: 9})
    const update = base64url.stringify(compressed)

    api.preview({
      entryId: editor.entryId,
      phase: selectedPhase,
      update
    })
  }, [api, yUpdate])
  return <BrowserPreview url={url.toString()} registerLivePreview={setApi} />
}
