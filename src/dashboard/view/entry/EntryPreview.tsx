import {Config} from 'alinea/core/Config'
import {Entry} from 'alinea/core/Entry'
import {useAtomValue} from 'jotai'
import {ComponentType, useEffect, useState} from 'react'
import {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
import {BrowserPreview} from '../preview/BrowserPreview.js'

export interface EntryPreviewProps {
  editor: EntryEditor
  preview: Config['preview']
}

export interface LivePreview {
  preview(payload: string): void
}

export function EntryPreview({editor, preview}: EntryPreviewProps) {
  if (!preview) return null
  if (typeof preview === 'string')
    return <EntryPreviewUrl editor={editor} preview={preview} />
  return <EntryPreviewComponent editor={editor} preview={preview} />
}

interface EntryPreviewUrlProps {
  editor: EntryEditor
  preview: string
}

function EntryPreviewUrl({editor, preview}: EntryPreviewUrlProps) {
  const payload = useAtomValue(editor.previewPayload)
  const previewToken = useAtomValue(editor.previewToken)
  const previewSearch = `?preview=${previewToken}`
  const [api, setApi] = useState<LivePreview | undefined>(undefined)
  useEffect(() => {
    if (!api) return
    api.preview(payload)
  }, [payload])
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
  const previewToken = useAtomValue(editor.previewToken)
  const Tag = preview
  return <Tag entry={entry} previewToken={previewToken} />
}
