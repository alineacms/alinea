import type {ComponentType} from 'react'
import {Hint} from './Hint.js'
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

export interface Picker<Row extends Reference, Options extends {} = {}> {
  shape: RecordShape
  fields: Type<any> | undefined
  hint: Hint
  label: Label
  handlesMultiple: boolean
  options: Options
  view?: ComponentType<PickerProps<Options>>
  viewRow?: ComponentType<{reference: Row}>
  postProcess?: PostProcess<Row>
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
