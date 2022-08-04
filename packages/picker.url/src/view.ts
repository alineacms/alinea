import {Picker} from '@alinea/editor/Picker'
import {createUrlPicker} from './UrlPicker'
import {UrlPickerModal} from './view/UrlPickerModal'
import {UrlPickerRow} from './view/UrlPickerRow'

export const urlPicker = Picker.withView(createUrlPicker, {
  view: UrlPickerModal,
  viewRow: UrlPickerRow
})

export {UrlReference} from './UrlPicker'
