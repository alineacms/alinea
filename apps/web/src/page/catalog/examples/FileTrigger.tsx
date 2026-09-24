'use client'

import {Button, FileTrigger} from 'alinea/components'
import {IcRoundUploadFile} from 'alinea/dashboard/icons'

export function FileTriggerExample() {
  return (
    <FileTrigger
      accept={['.pdf']}
      onSelect={([file]) => console.log(file.name)}
    >
      <Button variant="outline" icon={IcRoundUploadFile}>
        Upload size guide
      </Button>
    </FileTrigger>
  )
}
