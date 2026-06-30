import type {
  CSSProperties,
  ElementType,
  HTMLAttributes,
  PropsWithChildren
} from 'react'
import {createElement, forwardRef} from 'react'

export interface StackProps extends PropsWithChildren<
  Omit<HTMLAttributes<HTMLElement>, 'wrap'>
> {
  as?: ElementType
  gap?: number | string
  direction?: CSSProperties['flexDirection']
  align?: CSSProperties['alignItems']
  justify?: CSSProperties['justifyContent']
  horizontal?: boolean
  wrap?: boolean
  center?: boolean
  full?: boolean
  autoWidth?: boolean
}

function toCssSize(value: number | string | undefined): number | string {
  if (typeof value === 'number') return `${value}px`
  return value ?? 0
}

function stackStyle(props: StackProps): CSSProperties {
  const direction = props.direction ?? (props.horizontal ? 'row' : 'column')
  return {
    display: 'flex',
    minWidth: 0,
    flexDirection: direction,
    alignItems: props.center ? 'center' : props.align,
    justifyContent: props.justify,
    flexWrap: props.wrap ? 'wrap' : undefined,
    gap: toCssSize(props.gap),
    width: props.autoWidth
      ? undefined
      : props.full && direction === 'row'
        ? '100%'
        : undefined,
    height: props.full && direction !== 'row' ? '100%' : undefined
  }
}

/**
 * @deprecated Compatibility component for legacy dashboard extensions.
 */
export const VStack = forwardRef<HTMLElement, StackProps>(function VStack(
  {
    as: tag = 'div',
    children,
    style,
    gap,
    direction,
    align,
    justify,
    horizontal,
    wrap,
    center,
    full,
    autoWidth,
    ...props
  },
  ref
) {
  const layout = {
    gap,
    direction,
    align,
    justify,
    horizontal,
    wrap,
    center,
    full,
    autoWidth
  }
  return createElement(
    tag,
    {
      ...props,
      ref,
      style: {...stackStyle(layout), ...style}
    },
    children
  )
})

/**
 * @deprecated Compatibility component for legacy dashboard extensions.
 */
export const HStack = forwardRef<HTMLElement, StackProps>(
  function HStack(props, ref) {
    return createElement(VStack, {...props, direction: 'row', ref})
  }
)
