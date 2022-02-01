import {Outcome} from '@alinea/core/Outcome'
import {useCurrentDraft} from '@alinea/editor'
import {Loader} from '@alinea/ui/Loader'
import {ChangeEvent, useRef} from 'react'
import {useQuery} from 'react-query'
import {useSession} from '../hook/UseSession'
import {EntryHeader} from './entry/EntryHeader'
import {EntryTitle} from './entry/EntryTitle'

export type MediaExplorerProps = {}

export function MediaExplorer({}: MediaExplorerProps) {
  const draft = useCurrentDraft()
  const {hub} = useSession()
  const {data, isLoading} = useQuery(['media', draft.id], () => {
    return hub.list(draft.id).then(Outcome.unpack)
  })
  const inputRef = useRef<HTMLInputElement>(null)
  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = inputRef.current?.files?.[0]
    if (!file) return
    const contents = await file.arrayBuffer()
    return hub
      .uploadFile({
        path: draft.url + '/' + file.name,
        buffer: contents
      })
      .then(console.log)
  }
  return (
    <>
      <EntryHeader />
      <div>
        <EntryTitle />

        {isLoading ? (
          <Loader absolute />
        ) : (
          <div>
            <div>
              <input ref={inputRef} type="file" onChange={handleFileUpload} />
            </div>
            {data?.map(file => {
              return <div key={file.id}>{file.title}</div>
            })}
          </div>
        )}
      </div>
    </>
  )
}
