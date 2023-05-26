import {Entry} from 'alinea/core'
import {useAtomValue} from 'jotai'
import {useEffect, useState} from 'react'
import {usePreviewToken} from '../../atoms/EntryAtoms.js'
import {EntryEditor} from '../../atoms/EntryEditor.js'
import {BrowserPreview} from '../preview/BrowserPreview.js'

export interface EntryPreviewProps {
  editor: EntryEditor
  preview: string
}

export interface LivePreview {
  preview(entry: Entry): void
}

export function EntryPreview({editor, preview}: EntryPreviewProps) {
  const previewToken = usePreviewToken()
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const previewSearch = `?token=${previewToken}&entryId=${editor.entryId}&realm=${selectedPhase}`
  const url = new URL(previewSearch, preview)
  const [api, setApi] = useState<LivePreview | undefined>(undefined)
  const draftEntry = useAtomValue(editor.draftEntry)
  useEffect(() => {
    if (api) api.preview(draftEntry)
  }, [api, draftEntry])
  return <BrowserPreview url={url.toString()} registerLivePreview={setApi} />
}
