import {inputPath, Schema} from '@alinea/core'
import {
  CurrentDraftProvider,
  Fields,
  useCurrentDraft,
  useDraft,
  useInput
} from '@alinea/editor'
import {fromModule} from '@alinea/ui'
import {Suspense} from 'react'
import {Helmet} from 'react-helmet'
import {useSession} from '../hook/UseSession'
import css from './EntryEdit.module.scss'

const styles = fromModule(css)

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
  const session = useSession()
  const draft = useCurrentDraft()!
  const channel = Schema.getChannel(session.hub.schema, draft.$channel)
  return (
    <div className={styles.draft()}>
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
