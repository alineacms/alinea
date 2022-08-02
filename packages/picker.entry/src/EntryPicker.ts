import {Label} from '@alinea/core/Label'
import {Reference} from '@alinea/core/Reference'
import {Picker} from '@alinea/editor/Picker'
import {Expr} from '../../alinea/src/alinea'

export interface EntryReference extends Reference {
  type: 'entry'
}

export interface EntryPickerOptions {
  defaultView?: 'row' | 'thumb'
  condition?: Expr<boolean>
  max?: number
  showUploader?: boolean
  label?: Label
  title?: Label
}

export function createEntryPicker(
  options: EntryPickerOptions
): Picker<EntryReference, EntryPickerOptions> {
  return {
    type: 'entry',
    label: options.label || 'Page link',
    handlesMultiple: true,
    options
  }
}
