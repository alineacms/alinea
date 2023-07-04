import {UIStory} from 'alinea/ui/UIStory'
import {useState} from 'react'
import {UrlPickerForm} from './UrlPicker.browser.js'

export function PickerForm() {
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

export default {
  title: 'Pickers / Url'
}
