import {Label, Reference} from '@alinea/core'
import {RecordShape} from '@alinea/core/shape/RecordShape'
import {ComponentType} from 'react'

export interface PickerProps<T = {}> {
  type: string
  options: T
  selection: Array<Reference> | undefined
  onConfirm(value: Array<Reference> | undefined): void
  onCancel(): void
}

export interface Picker<
  Ref extends Reference = Reference,
  Options extends {} = {}
> {
  type: string
  shape: RecordShape
  label: Label
  handlesMultiple: boolean
  options: Options
  view?: ComponentType<PickerProps<Options>>
  viewRow?: ComponentType<{reference: Ref}>
}

export namespace Picker {
  export function withView<
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
}
