import type {ComponentType} from 'react'
import {Label} from './Label.js'
import {Reference} from './Reference.js'
import {Type} from './Type.js'
import {PostProcess} from './pages/PostProcess.js'
import {RecordShape} from './shape/RecordShape.js'

export interface PickerProps<T = any> {
  type: string
  options: T
  selection: Array<Reference> | undefined
  onConfirm(value: Array<Reference> | undefined): void
  onCancel(): void
}

export interface PickerRow {
  id: string
  type: string
  entry?: string
  url?: string
  description?: string
  target?: string
}

export interface Picker<
  StoredValue extends Reference,
  Options extends {} = {}
> {
  shape: RecordShape
  fields: Type<any> | undefined
  label: Label
  handlesMultiple: boolean
  options: Options
  view?: ComponentType<PickerProps<Options>>
  viewRow?: ComponentType<{reference: StoredValue}>
  postProcess?: PostProcess<StoredValue>
}

export function pickerWithView<
  R extends Reference,
  T extends {},
  C extends (...args: Array<any>) => Picker<R, T>
>(
  create: C,
  views: {
    view: ComponentType<PickerProps<T>>
    viewRow: ComponentType<{reference: R}>
  }
): C {
  const factory = (...args: Array<any>) => {
    const field: any = create(...args)
    return {...field, ...views}
  }
  return factory as any
}
