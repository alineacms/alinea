import styler from '@alinea/styler'
import {createElement, type ReactNode} from 'react'
import {Slot} from './internal/Slot.js'
import css from './Text.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface TextProps extends StyleProps, AriaProps, DataProps {
  /** The element to render, defaults to span */
  as?: 'span' | 'p' | 'div' | 'label' | 'small' | 'strong' | 'em'
  size?: 'xs' | 'sm' | 'default' | 'lg'
  weight?: 'regular' | 'medium' | 'semibold' | 'bold'
  color?:
    | 'default'
    | 'muted'
    | 'primary'
    | 'destructive'
    | 'warning'
    | 'success'
  align?: 'start' | 'center' | 'end'
  truncate?: boolean
  asChild?: boolean
  htmlFor?: string
  title?: string
  children: ReactNode
}

export function Text({
  as = 'span',
  size = 'default',
  weight,
  color,
  align,
  truncate,
  asChild,
  className,
  ...props
}: TextProps) {
  const attributes = {
    'data-slot': 'text',
    ...props,
    'data-size': size,
    'data-weight': weight,
    'data-color': color,
    'data-align': align,
    'data-truncate': truncate || undefined,
    className: styles.Text(styler.merge({className}))
  }
  if (asChild) return <Slot {...attributes} />
  return createElement(as, attributes)
}
