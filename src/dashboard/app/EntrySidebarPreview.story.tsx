import type {EntryLocaleAtoms} from '#/dashboard/atoms/entry.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {EntrySidebarBrowserPreview} from './EntrySidebarPreview.js'

const node = new ReactiveNode({title: 'Original title'})
const localeData = {
  previewUrl: atom(Promise.resolve('/preview-frame')),
  retryPreviewUrl: atom(null, () => {})
} satisfies Pick<EntryLocaleAtoms, 'previewUrl' | 'retryPreviewUrl'>

function PreviewTitleField() {
  const titleField = node.field('title')
  const value = useAtomValue(titleField)
  const setValue = useSetAtom(titleField)
  return (
    <label>
      Title
      <input
        aria-label="Title"
        value={typeof value === 'string' ? value : ''}
        onChange={event => setValue(event.currentTarget.value)}
      />
    </label>
  )
}

export function EntrySidebarPreviewStory() {
  return (
    <>
      <PreviewTitleField />
      <EntrySidebarBrowserPreview localeData={localeData} />
    </>
  )
}
