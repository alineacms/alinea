import {useState} from 'react'
import {IcRoundUploadFile} from '../dashboard/icons.js'
import {DropZone, DropZoneDescription, DropZoneTrigger} from './DropZone.js'

export function Example() {
  const [files, setFiles] = useState<Array<File>>([])
  return (
    <div style={{padding: 24, maxWidth: 480}}>
      <DropZone aria-label="Upload files" onDropFiles={setFiles}>
        <DropZoneTrigger icon={IcRoundUploadFile}>Browse files</DropZoneTrigger>
        <DropZoneDescription>Or drag and drop files here.</DropZoneDescription>
      </DropZone>
      <ul data-testid="files">
        {files.map(file => (
          <li key={file.name}>{file.name}</li>
        ))}
      </ul>
    </div>
  )
}

export function Images() {
  const [image, setImage] = useState<string>()
  return (
    <div style={{padding: 24, maxWidth: 480}}>
      <DropZone
        aria-label="Upload an image"
        accept={['image/png', 'image/jpeg']}
        multiple={false}
        onDropFiles={([file]) => setImage(URL.createObjectURL(file))}
      >
        {image ? (
          <img
            alt=""
            src={image}
            style={{display: 'block', maxWidth: '100%', height: 'auto'}}
          />
        ) : (
          <>
            <DropZoneTrigger>Upload an image</DropZoneTrigger>
            <DropZoneDescription>
              Or drag and drop a png or jpeg image here.
            </DropZoneDescription>
          </>
        )}
      </DropZone>
    </div>
  )
}

export function Disabled() {
  return (
    <div style={{padding: 24, maxWidth: 480}}>
      <DropZone aria-label="Upload files" disabled onDropFiles={() => {}}>
        <DropZoneTrigger>Browse files</DropZoneTrigger>
        <DropZoneDescription>Uploads are disabled.</DropZoneDescription>
      </DropZone>
    </div>
  )
}

export default {
  title: 'Pure components / DropZone'
}
