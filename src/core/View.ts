import {ComponentType} from 'react'

export type View<Props> =
  | string // Point to a component
  | ComponentType<Props> // Inline a function component

export function resolveView<Props>(
  viewMap: Record<string, ComponentType<any>>,
  view: View<Props>
): ComponentType<Props> | undefined {
  if (!(typeof view === 'string')) return view
  return viewMap[view]
}
