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
