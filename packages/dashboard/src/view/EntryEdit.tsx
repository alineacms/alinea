import {inputPath, Schema} from '@alinea/core'
import {
  CurrentDraftProvider,
  EntryDraftStatus,
  Fields,
  useCurrentDraft,
  useDraft,
  useInput
} from '@alinea/editor'
import {fromModule, Statusbar} from '@alinea/ui'
import {Suspense} from 'react'
import {Helmet} from 'react-helmet'
import {MdCheck, MdEdit, MdRotateLeft} from 'react-icons/md/index'
import {useQuery} from 'react-query'
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

type EntryEditStatusProps = {
  status: EntryDraftStatus
}

function EntryEditStatus({status}: EntryEditStatusProps) {
  switch (status) {
    case EntryDraftStatus.Synced:
      return <Statusbar.Status icon={MdCheck}>Synced</Statusbar.Status>
    case EntryDraftStatus.Pending:
      return <Statusbar.Status icon={MdEdit}>Editing</Statusbar.Status>
    case EntryDraftStatus.Saving:
      return <Statusbar.Status icon={MdRotateLeft}>Saving</Statusbar.Status>
  }
}

type EntryEditDraftProps = {}

function EntryEditDraft({}: EntryEditDraftProps) {
  const session = useSession()
  const [draft, status] = useCurrentDraft()!
  const channel = Schema.getChannel(session.hub.schema, draft.$channel)
  return (
    <div className={styles.draft()}>
      <EntryEditHeader />
      <Suspense fallback={null}>
        {channel ? <Fields channel={channel} /> : 'Channel not found'}
      </Suspense>

      <Statusbar.Slot>
        <EntryEditStatus status={status} />
      </Statusbar.Slot>
    </div>
  )
}

export type EntryEditProps = {id: string}

export function EntryEdit({id}: EntryEditProps) {
  const {hub} = useSession()
  const {isLoading, data} = useQuery(
    ['entry', id],
    () => hub.content.entryWithDraft(id),
    {refetchOnMount: false, refetchOnWindowFocus: false}
  )
  const draft = useDraft(data!, doc => {
    return hub.content.putDraft(id, doc)
  })
  if (!draft) return null
  return (
    <>
      <CurrentDraftProvider value={draft}>
        <EntryEditDraft />
      </CurrentDraftProvider>
    </>
  )
}
