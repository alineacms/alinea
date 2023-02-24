import {Picker} from 'alinea/editor/Picker'
import {createUrlPicker} from './UrlPicker.js'
import {UrlPickerModal} from './view/UrlPickerModal.js'
import {UrlPickerRow} from './view/UrlPickerRow.js'

export const urlPicker = Picker.withView(createUrlPicker, {
  view: UrlPickerModal,
  viewRow: UrlPickerRow
})

export {UrlReference} from './UrlPicker.js'
