import {Config, Entry, PreviewUpdate} from 'alinea/core'
import {base64url} from 'alinea/core/util/Encoding'
import {zlibSync} from 'fflate'
import {useAtomValue} from 'jotai'
import {ComponentType, Suspense, useEffect, useState} from 'react'
import {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
import {BrowserPreview} from '../preview/BrowserPreview.js'

export interface EntryPreviewProps {
  editor: EntryEditor
  preview: Config['preview']
}

export interface LivePreview {
  preview(update: PreviewUpdate): void
}

export function EntryPreview({editor, preview}: EntryPreviewProps) {
  if (!preview) return null
  if (typeof preview === 'string')
    return <EntryPreviewUrl editor={editor} preview={preview} />
  return (
    <Suspense>
      <EntryPreviewComponent editor={editor} preview={preview} />
    </Suspense>
  )
}

interface EntryPreviewUrlProps {
  editor: EntryEditor
  preview: string
}

function EntryPreviewUrl({editor, preview}: EntryPreviewUrlProps) {
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const previewSearch = `?token=${editor.previewToken}&entryId=${editor.entryId}&realm=${selectedPhase}`
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
  const base = new URL(preview, location.href)
  const url = new URL(previewSearch, base)
  return <BrowserPreview url={url.toString()} registerLivePreview={setApi} />
}

interface EntryPreviewComponentProps {
  editor: EntryEditor
  preview: ComponentType<{entry: Entry; previewToken: string}>
}

function EntryPreviewComponent({editor, preview}: EntryPreviewComponentProps) {
  const entry = useAtomValue(editor.draftEntry)
  const Tag = preview
  return <Tag entry={entry} previewToken={editor.previewToken} />
}
