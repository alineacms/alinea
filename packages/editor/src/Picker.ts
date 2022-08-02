import {Label, Reference} from '@alinea/core'
import {ComponentType} from 'react'

export interface PickerOptions {
  type: string
  selection: Array<Reference> | undefined
}

export interface PickerProps<T = {}> {
  options: T
  onConfirm(value: Array<Reference> | undefined): void
  onCancel(): void
}

export interface Picker<T extends PickerOptions = PickerOptions> {
  type: string
  label: Label
  view?: ComponentType<PickerProps<T>>
}

export namespace Picker {
  export function withView<
    T extends PickerOptions,
    C extends (...args: Array<any>) => Picker<T>
  >(create: C, view: ComponentType<PickerProps<T>>): C {
    const factory = (...args: Array<any>) => {
      const field: any = create(...args)
      return {...field, view}
    }
    return factory as any
  }
}
