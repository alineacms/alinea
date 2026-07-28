import type {DragItem, DragTypes} from '@react-types/shared'
import type {Key} from 'react-aria-components'

export const dashboardEntryDragType = 'application/x-alinea-entry-id'

export const dashboardEntryDragTypes = [
  dashboardEntryDragType,
  'text/plain'
] as const

export function acceptsDashboardEntryDrag(types: DragTypes): boolean {
  return dashboardEntryDragTypes.some(type => types.has(type))
}

export function dashboardEntryDragItem(id: Key): DragItem {
  const key = String(id)
  return {
    'text/plain': key,
    [dashboardEntryDragType]: key
  }
}
