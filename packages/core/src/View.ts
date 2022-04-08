import {Collection, SelectionInput, Store} from '@alineacms/store'
import type {ComponentType} from 'react'
import {Schema} from './Schema'

type ViewSelection<T, S> = (collection: Collection<T>) => S
type ViewSelectionGeneric = <T>(collection: Collection<T>) => SelectionInput

export type View<
  T,
  Props = any,
  S extends SelectionInput = SelectionInput
> = ComponentType<Props> & {
  selection: ViewSelectionGeneric
}

export function view<
  T,
  S extends SelectionInput,
  Params extends Store.TypeOf<S>
>(
  selection: ViewSelection<T, S>,
  component: ComponentType<Params>
): View<T, Params> {
  return Object.assign(component, {selection}) as any
}

export namespace View {
  export function getSelection<T>(
    schema: Schema,
    summaryView: 'summaryRow' | 'summaryThumb',
    collection: Collection<T>
  ) {
    const cases: Record<string, SelectionInput> = {}
    for (const [name, type] of schema) {
      const view = type.options[summaryView]
      if (view) cases[name] = view.selection(collection)
    }
    return cases
  }
}
