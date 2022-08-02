import {UIStory} from '@alinea/ui/UIStory'
import {useState} from 'react'
import {ExternalLinkPickerForm} from './ExternalLinkPicker'

export function Picker() {
  const [open, setOpen] = useState(true)
  return (
    <UIStory>
      <ExternalLinkPickerForm
        options={{}}
        onConfirm={console.log}
        onCancel={() => setOpen(false)}
      />
    </UIStory>
  )
}
