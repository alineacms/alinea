import styler from '@alinea/styler'
import type {ReactNode, Ref} from 'react'
import {Slot} from './internal/Slot.js'
import css from './Stack.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface StackProps extends StyleProps, AriaProps, DataProps {
  /** Defaults to `column` */
  direction?: 'row' | 'column'
  /** Space between the items, a number is in pixels */
  gap?: number | string
  /** Cross axis alignment of the items, they stretch by default */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  /** Main axis distribution of the items */
  justify?: 'start' | 'center' | 'end' | 'between'
  /** Wrap items onto multiple lines */
  wrap?: boolean
  /** Lay out the single child element instead of rendering a div */
  asChild?: boolean
  ref?: Ref<HTMLDivElement>
  children?: ReactNode
}

/** Lays out its children in a row or column with a gap between them */
export function Stack({
  direction = 'column',
  gap,
  align,
  justify,
  wrap,
  asChild,
  className,
  style,
  ...props
}: StackProps) {
  const Element = asChild ? Slot : 'div'
  return (
    <Element
      data-slot="stack"
      {...props}
      data-direction={direction}
      data-align={align}
      data-justify={justify}
      data-wrap={wrap || undefined}
      className={styles.Stack(styler.merge({className}))}
      style={gap === undefined ? style : {gap, ...style}}
    />
  )
}
