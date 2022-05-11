import {Entry} from '@alinea/core'
import {useObservable} from '@alinea/ui'
import {ComponentType} from 'react'
import {EntryDraft} from '../../draft/EntryDraft'

export type EntryPreviewProps = {
  draft: EntryDraft
  preview: ComponentType<{entry: Entry; previewToken: string}>
}

export function EntryPreview({draft, preview: Preview}: EntryPreviewProps) {
  const entry = useObservable(draft.entry)
  return <Preview entry={entry} previewToken={draft.detail.previewToken} />
}
