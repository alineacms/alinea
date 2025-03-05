import {Config} from 'alinea/core/Config'
import {Entry} from 'alinea/core/Entry'
import {useAtomValue} from 'jotai'
import {unwrap} from 'jotai/utils'
import {ComponentType, useEffect, useState} from 'react'
import {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
import {useConfig} from '../../hook/UseConfig.js'
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
  if (typeof preview === 'boolean') return <EntryPreviewUrl editor={editor} />
  return <EntryPreviewComponent editor={editor} preview={preview} />
}

interface EntryPreviewUrlProps {
  editor: EntryEditor
}

function EntryPreviewUrl({editor}: EntryPreviewUrlProps) {
  const config = useConfig()
  const payload = useAtomValue(unwrap(editor.previewPayload))
  const previewToken = useAtomValue(editor.previewToken)
  const previewSearch = `?preview=${previewToken}`
  const [api, setApi] = useState<LivePreview | undefined>(undefined)
  useEffect(() => {
    if (payload) api?.preview(payload)
  }, [payload])
  const base = new URL(
    config.handlerUrl ?? '',
    Config.baseUrl(config) ?? location.href
  )
  const url = new URL(previewSearch, base)
  return <BrowserPreview url={url.toString()} registerLivePreview={setApi} />
}

interface EntryPreviewComponentProps {
  editor: EntryEditor
  preview: ComponentType<{entry: Entry}>
}

function EntryPreviewComponent({editor, preview}: EntryPreviewComponentProps) {
  const entry = useAtomValue(editor.draftEntry)
  const Tag = preview
  return <Tag entry={entry} />
}
