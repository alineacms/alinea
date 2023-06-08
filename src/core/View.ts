import type {ComponentType} from 'react'
import {Page} from './Page.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {Projection} from './pages/Projection.js'
import {Selection} from './pages/Selection.js'
import {assign, entries} from './util/Objects.js'

type ViewSelection<T, S> = () => S
type ViewSelectionGeneric = () => Projection

export type View<
  T,
  Props = any,
  S extends Projection = Projection
> = ComponentType<Props> & {
  selection: ViewSelectionGeneric
}

export function view<
  T,
  S extends Projection,
  Params extends Projection.Infer<S>
>(
  selection: ViewSelection<T, S>,
  component: ComponentType<Params>
): View<T, Params> {
  return assign(component, {selection}) as any
}

export namespace View {
  export function getSelection(
    schema: Schema,
    summaryView: 'summaryRow' | 'summaryThumb',
    defaultSelection: Projection
  ): Selection {
    let select
    for (const [name, type] of entries(schema)) {
      const view = Type.meta(type!)[summaryView]
      if (view) {
        const selection: any = view.selection()
        select = select
          ? select.when(name, selection)
          : Page.type.when(name, selection)
      }
    }
    return select
      ? Selection.create(select.orElse(defaultSelection))
      : Selection.create(defaultSelection)
  }
}
