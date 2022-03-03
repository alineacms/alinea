import {Button} from '@alinea/ui'
import {MdUploadFile} from 'react-icons/md'

export function FileUploader() {
  return (
    <div>
      <MdUploadFile size={30} />
      Drag your documents or photos here to start uploading
      <div>or</div>
      <Button>Browse files</Button>
    </div>
  )
}
