import {Channel, Entry, Field} from '@alinea/core'
import {Suspense} from 'react'
import {useQuery} from 'react-query'
import {useApp} from '../App'

type EntryEditFieldProps = {
  name: string
  field: Field
}
function MissingView() {
  return <div>Missing view</div>
}

function EntryEditField({field}: EntryEditFieldProps) {
  const View = field.view
  if (!View) return <MissingView />
  return (
    <div>
      <View field={field} />
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
        return <EntryEditField key={name} name={name} field={field} />
      })}
    </div>
  )
}

export type EntryEditProps = {path: string}

export function EntryEdit({path}: EntryEditProps) {
  const {client} = useApp()
  const {data} = useQuery(['entry', path], () => client.content.get(path), {
    keepPreviousData: true
  })
  /*const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Hello World! 🌎️</p>'
  })*/
  if (!data) return null
  const channel = client.schema.getChannel(data.channel)
  return (
    <div style={{padding: '50px 100px', height: '100%', overflow: 'auto'}}>
      <h1 style={{position: 'relative', zIndex: 1, paddingBottom: '10px'}}>
        {data.title}
      </h1>
      <Suspense fallback={null}>
        {channel ? (
          <EntryEditFields channel={channel} entry={data} />
        ) : (
          'Channel not found'
        )}
      </Suspense>
    </div>
  )
}
