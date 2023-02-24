import {Picker} from 'alinea/editor/Picker'
import {createEntryPicker} from './EntryPicker.js'
import {EntryPickerModal} from './view/EntryPickerModal.js'
import {EntryPickerRow} from './view/EntryPickerRow.js'

export const entryPicker = Picker.withView(createEntryPicker, {
  view: EntryPickerModal,
  viewRow: EntryPickerRow
})

export {EntryReference, FileReference, ImageReference} from './EntryPicker.js'
