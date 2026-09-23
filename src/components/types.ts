import type {ComponentType, CSSProperties, SVGProps} from 'react'

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
