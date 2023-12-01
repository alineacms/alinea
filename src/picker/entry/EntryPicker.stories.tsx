import {UIStory} from 'alinea/ui/UIStory'
import {useState} from 'react'
import {EntryPickerModal} from './EntryPicker.browser.js'

export function ImagePicker() {
  const [open, setOpen] = useState(true)
  return (
    <UIStory>
      {open ? (
        <EntryPickerModal
          type="image"
          selection={[]}
          options={{
            hint: undefined!,
            selection: undefined!,
            showMedia: true
          }}
          onConfirm={console.log}
          onCancel={() => setOpen(false)}
        />
      ) : (
        <button onClick={() => setOpen(true)}>Open</button>
      )}
    </UIStory>
  )
}

export function EntryPicker() {
  const [open, setOpen] = useState(true)
  return (
    <UIStory>
      {open ? (
        <EntryPickerModal
          type="entry"
          selection={[]}
          options={{
            hint: undefined!,
            selection: undefined!
          }}
          onConfirm={console.log}
          onCancel={() => setOpen(false)}
        />
      ) : (
        <button onClick={() => setOpen(true)}>Open</button>
      )}
    </UIStory>
  )
}
