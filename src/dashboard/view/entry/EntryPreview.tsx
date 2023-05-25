import {useAtomValue} from 'jotai'
import {ComponentType} from 'react'
import {usePreviewToken} from '../../atoms/EntryAtoms.js'
import {EntryEditor} from '../../atoms/EntryEditor.js'

export type EntryPreviewProps = {
  editor: EntryEditor
  preview: ComponentType<{previewToken: string}>
}

export function EntryPreview({editor, preview: Preview}: EntryPreviewProps) {
  const entry = useAtomValue(editor.draftEntry)
  const previewToken = usePreviewToken(editor.entryId)
  return <Preview previewToken={previewToken} />
}
