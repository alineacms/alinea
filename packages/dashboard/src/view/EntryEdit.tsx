import {Channel, Entry, Field, inputPath, InputPath} from '@alinea/core'
import {
  EntryDraft,
  EntryDraftProvider,
  useEntryDraft,
  useInput
} from '@alinea/editor'
import {Suspense} from 'react'
import {Helmet} from 'react-helmet'
import {useQuery} from 'react-query'
import {useApp} from '../App'

type EntryEditFieldProps<T> = {
  path: InputPath<T>
  field: Field<T>
}
function MissingView() {
  return <div>Missing view</div>
}

function EntryEditField<T>({path, field}: EntryEditFieldProps<T>) {
  const View = field.view
  if (!View) return <MissingView />
  return (
    <div>
      <View path={path} field={field} />
    </div>
  )
}

type EntryEditFieldsProps = {
  channel: Channel
  entry: Entry
}

function EntryEditFields({channel, entry}: EntryEditFieldsProps) {
  const fields = Channel.fields(channel)
  return (
    <div>
      {fields.map(([name, field]) => {
        return (
          <EntryEditField key={name} path={inputPath([name])} field={field} />
        )
      })}
    </div>
  )
}

function EntryEditHeader() {
  const title = useInput(inputPath<string>(['title']))
  return (
    <h1 style={{position: 'relative', zIndex: 1, paddingBottom: '10px'}}>
      {title.value}
      <Helmet>
        <title>{title.value}</title>
      </Helmet>
    </h1>
  )
}

type EntryEditDraftProps = {}

function EntryEditDraft({}: EntryEditDraftProps) {
  const {client} = useApp()
  const draft = useEntryDraft()!
  const channel = client.schema.getChannel(draft.channel)
  return (
    <div style={{padding: '50px 100px', height: '100%', overflow: 'auto'}}>
      <EntryEditHeader />
      <Suspense fallback={null}>
        {channel ? (
          <EntryEditFields channel={channel} entry={draft} />
        ) : (
          'Channel not found'
        )}
      </Suspense>
    </div>
  )
}

export type EntryEditProps = {path: string}

export function EntryEdit({path}: EntryEditProps) {
  const {client} = useApp()
  const {data: draft} = useQuery(
    ['entry', path],
    () =>
      client.content.get(path).then(res => {
        if (res) return new EntryDraft(res)
        return res
      }),
    {
      keepPreviousData: true
    }
  )
  if (!draft) return null
  return (
    <EntryDraftProvider value={draft}>
      <EntryEditDraft />
    </EntryDraftProvider>
  )
}
