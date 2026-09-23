import {useState} from 'react'
import {IcRoundUploadFile} from '../dashboard/icons.js'
import {Button} from './Button.js'
import {FileTrigger} from './FileTrigger.js'

export function Example() {
  const [files, setFiles] = useState<Array<File>>([])
  return (
    <div style={{padding: 24}}>
      <FileTrigger multiple onSelect={setFiles}>
        <Button icon={IcRoundUploadFile} color="primary">
          Upload files
        </Button>
      </FileTrigger>
      <ul data-testid="files">
        {files.map(file => (
          <li key={file.name}>{file.name}</li>
        ))}
      </ul>
    </div>
  )
}

export function Images() {
  const [file, setFile] = useState<File>()
  return (
    <div style={{padding: 24}}>
      <FileTrigger
        accept={['image/png', 'image/jpeg']}
        onSelect={([file]) => setFile(file)}
      >
        <Button variant="outline">Pick an image</Button>
      </FileTrigger>
      <p data-testid="file">{file?.name}</p>
    </div>
  )
}

export default {
  title: 'Pure components / FileTrigger'
}
