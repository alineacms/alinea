import styler from '@alinea/styler'
import {createElement, type ReactNode} from 'react'
import css from './Heading.module.css'
import {Slot} from './internal/Slot.js'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface HeadingProps extends StyleProps, AriaProps, DataProps {
  /** The heading element, defaults to h1 */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  /** Visual size, defaults to one matching the element */
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'xl'
  weight?: 'medium' | 'semibold' | 'bold'
  truncate?: boolean
  asChild?: boolean
  children: ReactNode
}

const defaultSizes = {
  h1: 'xl',
  h2: 'lg',
  h3: 'default',
  h4: 'sm',
  h5: 'xs',
  h6: 'xs'
} as const

export function Heading({
  as = 'h1',
  size = defaultSizes[as],
  weight,
  truncate,
  asChild,
  className,
  ...props
}: HeadingProps) {
  const attributes = {
    'data-slot': 'heading',
    ...props,
    'data-size': size,
    'data-weight': weight,
    'data-truncate': truncate || undefined,
    className: styles.Heading(styler.merge({className}))
  }
  if (asChild) return <Slot {...attributes} />
  return createElement(as, attributes)
}
