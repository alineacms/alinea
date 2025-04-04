import type {ComponentType, ReactNode} from 'react'

export type View<Props> =
  | string // Point to a component
  | ((props: Props) => ReactNode) // Inline a function component

export function resolveView<Props>(
  viewMap: Record<string, ComponentType<any>>,
  view: View<Props>
): ComponentType<Props> | undefined {
  if (!(typeof view === 'string')) return view
  return viewMap[view]
}
