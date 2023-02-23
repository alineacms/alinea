import {Picker} from 'alinea/editor/Picker'
import {createEntryPicker} from './EntryPicker'
import {EntryPickerModal} from './view/EntryPickerModal'
import {EntryPickerRow} from './view/EntryPickerRow'

export const entryPicker = Picker.withView(createEntryPicker, {
  view: EntryPickerModal,
  viewRow: EntryPickerRow
})

export {EntryReference, FileReference, ImageReference} from './EntryPicker'
