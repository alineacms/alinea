import type {
  ComponentType,
  CSSProperties,
  ReactElement,
  ReactNode,
  SVGProps
} from 'react'

export type Key = string | number

export type IconType = ComponentType<SVGProps<SVGSVGElement>>

export type Side = 'top' | 'right' | 'bottom' | 'left'

export type Align = 'start' | 'center' | 'end'

export interface StyleProps {
  className?: string
  style?: CSSProperties
}

export interface AriaProps {
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export interface OpenStateProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export interface PositionProps {
  side?: Side
  align?: Align
  sideOffset?: number
  alignOffset?: number
}

export interface DataProps {
  [attribute: `data-${string}`]: string | number | boolean | undefined
}

export type Orientation = 'horizontal' | 'vertical'

export type SelectionMode = 'none' | 'single' | 'multiple'

/** Either every item, or the set of selected keys */
export type Selection = 'all' | ReadonlySet<Key>

export interface SelectionProps {
  selectionMode?: SelectionMode
  selectedKeys?: Selection
  defaultSelectedKeys?: Selection
  onSelectionChange?: (keys: Selection) => void
  disabledKeys?: Iterable<Key>
}

export type SortDirection = 'asc' | 'desc'

export interface SortDescriptor {
  column: Key
  direction: SortDirection
}

/** Label, help text and validation state shared by every form control */
export interface FieldSharedProps {
  label?: ReactNode
  description?: ReactNode
  error?: ReactNode
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  icon?: IconType | ReactElement
  /** Marks the field as shared between translations */
  shared?: boolean
}

/** Where dragged items are dropped, relative to the item with `key` */
export interface DropTarget {
  key: Key
  position: 'before' | 'after' | 'on'
}

/** The data types a drag operation carries */
export interface DragTypes {
  has(type: string): boolean
}

/** Keys of dragged items and where they were dropped */
export interface DragMoveEvent {
  keys: ReadonlySet<Key>
  target: DropTarget
}

/** Data of items dragged in from outside the collection */
export interface DropItemsEvent {
  items: Array<Record<string, string>>
  target: DropTarget
}

/** Files dropped on an item, or on the collection itself */
export interface DropFilesEvent {
  files: Array<File>
  target?: DropTarget
}

/** Declarative drag and drop for collections */
export interface DragDropProps {
  /** Data for the dragged items, keyed by mime type. Enables dragging. */
  getDragData?: (keys: ReadonlySet<Key>) => Array<Record<string, string>>
  /** Drag types accepted on drop, defaults to every type */
  acceptedDragTypes?: Array<string>
  /** Return false to reject a drop target */
  canDrop?: (target: DropTarget, types: DragTypes) => boolean
  /** Items of this collection dropped before or after an item */
  onReorder?: (event: DragMoveEvent) => void
  /** Items of this collection dropped on an item */
  onMove?: (event: DragMoveEvent) => void
  /** Items from outside dropped on or next to an item */
  onDropItems?: (event: DropItemsEvent) => void
  /** Files dropped on an item or on the collection */
  onDropFiles?: (event: DropFilesEvent) => void
}
