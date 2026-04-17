import styler from '@alinea/styler'
import {
  OverlayArrow,
  Tooltip as TooltipPrimitive,
  type TooltipProps as TooltipPrimitiveProps,
  TooltipTrigger
} from 'react-aria-components'
import type {TooltipTriggerProps} from '@react-types/tooltip'
import type {ReactNode} from 'react'
import css from './Tooltip.module.css'

const styles = styler(css)

export interface TooltipProps
  extends TooltipPrimitiveProps,
    TooltipTriggerProps {
  children: ReactNode
  tooltip: ReactNode
}

export function Tooltip({tooltip, children, ...props}: TooltipProps) {
  const {className, ...rest} = props
  return (
    <TooltipTrigger {...props}>
      {children}
      <TooltipPrimitive
        {...rest}
        className={renderProps =>
          styles.Tooltip(
            styler.merge({
              className:
                typeof className === 'function'
                  ? className(renderProps)
                  : className
            })
          )
        }
      >
        <OverlayArrow className={styles.Tooltip.arrow()}>
          <svg width={8} height={8} viewBox="0 0 8 8">
            <path d="M0 0 L4 4 L8 0" />
          </svg>
        </OverlayArrow>
        {tooltip}
      </TooltipPrimitive>
    </TooltipTrigger>
  )
}
