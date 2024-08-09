import {Config} from 'alinea/core/Config'
import {Entry} from 'alinea/core/Entry'
import {PreviewUpdate} from 'alinea/core/Resolver'
import {base64url} from 'alinea/core/util/Encoding'
import {zlibSync} from 'fflate'
import {useAtomValue} from 'jotai'
import {ComponentType, useEffect, useState} from 'react'
import {dbMetaAtom} from '../../atoms/DbAtoms.js'
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
  return <EntryPreviewComponent editor={editor} preview={preview} />
}

interface EntryPreviewUrlProps {
  editor: EntryEditor
  preview: string
}

function EntryPreviewUrl({editor, preview}: EntryPreviewUrlProps) {
  const {contentHash} = useAtomValue(dbMetaAtom)
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const previewToken = useAtomValue(editor.previewToken)
  const previewSearch = `?preview=${previewToken}`
  const [api, setApi] = useState<LivePreview | undefined>(undefined)
  const yUpdate = useAtomValue(editor.yUpdate)
  useEffect(() => {
    if (!api) return
    const compressed = zlibSync(yUpdate, {level: 9})
    const update = base64url.stringify(compressed)
    api.preview({
      entryId: editor.entryId,
      contentHash: contentHash,
      phase: selectedPhase,
      update
    })
  }, [api, yUpdate, contentHash])
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
