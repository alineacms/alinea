import {Label} from '@alinea/core/Label'
import {Reference} from '@alinea/core/Reference'
import {Shape} from '@alinea/core/Shape'
import {TypeConfig} from '@alinea/core/Type'
import {Picker} from '@alinea/editor/Picker'
import {Expr} from '../../alinea/src/alinea'

export interface EntryReference extends Reference {
  type: 'entry'
  entry: string
}

export interface EntryPickerOptions<T = {}> {
  defaultView?: 'row' | 'thumb'
  condition?: Expr<boolean>
  max?: number
  showUploader?: boolean
  label?: Label
  title?: Label
  fields?: TypeConfig<any, T>
}

export function createEntryPicker<T>(
  options: EntryPickerOptions<T>
): Picker<EntryReference, EntryPickerOptions<T>> {
  const extra = options.fields?.shape
  return {
    type: 'entry',
    shape: Shape.Record('Entry', {
      entry: Shape.Scalar('Entry')
    }).concat(extra),
    label: options.label || 'Page link',
    handlesMultiple: true,
    options
  }
}
