import type {EntryLocaleAtoms} from '#/dashboard/atoms/entry.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {EntrySidebarBrowserPreview} from './EntrySidebarPreview.js'

const node = new ReactiveNode({title: 'Original title'})
const previewUrlRequest = atom<Promise<string>>(
  Promise.resolve('/preview-frame')
)
const localeData = {
  previewPayloadSignal: atom(get => [get(node.value)]),
  previewUrl: unwrap(previewUrlRequest, previous => previous),
  retryPreviewUrl: atom(null, () => {}),
  updatePreviewPayload: atom(null, async get => {
    return JSON.stringify({
      ...get(node.value),
      sha: 'preview-content-sha'
    })
  })
} satisfies Pick<
  EntryLocaleAtoms,
  | 'previewPayloadSignal'
  | 'previewUrl'
  | 'retryPreviewUrl'
  | 'updatePreviewPayload'
>
const refreshPreviewUrl = atom(null, (_get, set) => {
  set(
    previewUrlRequest,
    new Promise(resolve => {
      setTimeout(() => resolve('/preview-frame'), 500)
    })
  )
})

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

function RefreshPreviewUrlButton() {
  const refresh = useSetAtom(refreshPreviewUrl)
  return <button onClick={() => refresh()}>Refresh preview URL</button>
}

export function EntrySidebarPreviewStory() {
  return (
    <>
      <PreviewTitleField />
      <RefreshPreviewUrlButton />
      <EntrySidebarBrowserPreview localeData={localeData} />
    </>
  )
}
