import styler from '@alinea/styler'
import type {ReactNode, Ref} from 'react'
import {
  type PopoverProps as PopoverPrimitiveProps,
  Popover as PopoverPrimitive
} from 'react-aria-components'
import css from './PopoverSurface.module.css'

const styles = styler(css)

export interface PopoverSurfaceProps extends Omit<
  PopoverPrimitiveProps,
  'children' | 'className'
> {
  className?: string
  ref?: Ref<HTMLElement>
  children: ReactNode
  [attribute: `data-${string}`]: string | number | boolean | undefined
}

/**
 * The styled react-aria popover. Components that compose react-aria
 * collections (Select, ComboBox, ...) render this directly, the public
 * Popover components are built on top of it.
 */
export function PopoverSurface({className, ...props}: PopoverSurfaceProps) {
  return (
    <PopoverPrimitive
      {...props}
      className={styles.PopoverSurface(styler.merge({className}))}
    />
  )
}
