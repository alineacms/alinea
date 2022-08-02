import {UIStory} from '@alinea/ui/UIStory'
import {useState} from 'react'
import {UrlPickerForm} from './UrlPickerModal'

export function Picker() {
  const [open, setOpen] = useState(true)
  return (
    <UIStory>
      <UrlPickerForm
        type="url"
        selection={[]}
        options={{}}
        onConfirm={console.log}
        onCancel={() => setOpen(false)}
      />
    </UIStory>
  )
}
