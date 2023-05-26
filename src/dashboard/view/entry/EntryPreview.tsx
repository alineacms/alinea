import {ComponentType} from 'react'
import {usePreviewToken} from '../../atoms/EntryAtoms.js'
import {EntryEditor} from '../../atoms/EntryEditor.js'

export type EntryPreviewProps = {
  editor: EntryEditor
  preview: ComponentType<{previewSearch: string}>
}

export function EntryPreview({editor, preview: Preview}: EntryPreviewProps) {
  const previewToken = usePreviewToken()
  const previewSearch = `?token=${previewToken}&entryId=${editor.entryId}&realm=${editor.selectedPhase}`
  return <Preview previewSearch={previewSearch} />
}
