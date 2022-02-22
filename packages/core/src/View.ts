import {Collection, SelectionInput, Store} from '@alinea/store'
import type {ComponentType} from 'react'

type ViewSelection<T, S> = (collection: Collection<T>) => S
type ViewSelectionGeneric = (collection: Collection<any>) => SelectionInput & {}

declare const $viewtype: unique symbol

export type View<Of = any, Props = any> = ComponentType<Props> & {
  [$viewtype]: Of
  selection: ViewSelectionGeneric
}

export function view<T, S extends SelectionInput = SelectionInput>(
  selection: ViewSelection<T, S>,
  view: ComponentType<Store.TypeOf<S>>
) {
  return Object.assign(view, {selection}) as unknown as View<T, Store.TypeOf<S>>
}
