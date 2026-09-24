'use client'

import {DropZone, DropZoneDescription, DropZoneTrigger} from 'alinea/components'
import {IcRoundUploadFile} from 'alinea/dashboard/icons'

export function DropZoneExample() {
  return (
    <DropZone
      aria-label="Upload product photos"
      accept={['image/*']}
      onDropFiles={files => console.log(files)}
      style={{width: 320}}
    >
      <DropZoneTrigger icon={IcRoundUploadFile}>Browse photos</DropZoneTrigger>
      <DropZoneDescription>Or drag and drop images here.</DropZoneDescription>
    </DropZone>
  )
}
