import {inputPath} from '@alinea/core'
import {
  CurrentDraftProvider,
  Fields,
  useCurrentDraft,
  useDraft,
  useInput
} from '@alinea/editor'
import {Suspense} from 'react'
import {Helmet} from 'react-helmet'
import {useApp} from '../App'

function EntryEditHeader() {
  const [title] = useInput(inputPath<string>(['title']))
  return (
    <header>
      <h1 style={{position: 'relative', zIndex: 1, paddingBottom: '10px'}}>
        {title}
        <Helmet>
          <title>{title}</title>
        </Helmet>
      </h1>
    </header>
  )
}

type EntryEditDraftProps = {}

function EntryEditDraft({}: EntryEditDraftProps) {
  const {client} = useApp()
  const draft = useCurrentDraft()!
  const channel = client.schema.getChannel(draft.channel)
  return (
    <div style={{padding: '50px 100px', height: '100%', overflow: 'auto'}}>
      <EntryEditHeader />
      <Suspense fallback={null}>
        {channel ? <Fields channel={channel} /> : 'Channel not found'}
      </Suspense>
    </div>
  )
}

export type EntryEditProps = {path: string}

export function EntryEdit({path}: EntryEditProps) {
  const draft = useDraft(path)
  if (!draft) return null
  return (
    <CurrentDraftProvider value={draft}>
      <EntryEditDraft />
    </CurrentDraftProvider>
  )
}
