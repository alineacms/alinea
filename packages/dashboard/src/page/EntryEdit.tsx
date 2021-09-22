import React from 'react'
import {useQuery} from 'react-query'
import {useApp} from '../App'

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
  return (
    <div style={{padding: '10px', height: '100%', overflow: 'auto'}}>
      <h1 style={{position: 'relative', zIndex: 1}}>{data.title}</h1>

      <textarea
        spellCheck="false"
        style={{
          width: '100%',
          marginTop: '30px',
          height: '500px',
          fontFamily: 'monospace',
          background: '#191A1F',
          color: 'rgb(204, 204, 204)',
          padding: '10px',
          lineHeight: 1.5
        }}
        placeholder="Fill some data"
        value={JSON.stringify(data, null, '  ')}
      />
    </div>
  )
}
