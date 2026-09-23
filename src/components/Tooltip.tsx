import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {
  OverlayArrow,
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive
} from 'react-aria-components'
import {placement} from './internal/Placement.js'
import {Trigger, type TriggerProps} from './internal/Trigger.js'
import css from './Tooltip.module.css'
import type {
  DataProps,
  OpenStateProps,
  PositionProps,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface TooltipProps extends OpenStateProps {
  /** Milliseconds the pointer rests on the trigger before the tooltip opens */
  delayDuration?: number
  /** Milliseconds before the tooltip closes once the pointer leaves */
  closeDelay?: number
  disabled?: boolean
  children: ReactNode
}

/** Shows a short description when the trigger is hovered or focused */
export function Tooltip({
  open,
  defaultOpen,
  onOpenChange,
  delayDuration,
  closeDelay,
  disabled,
  children
}: TooltipProps) {
  return (
    <TooltipTriggerPrimitive
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      delay={delayDuration}
      closeDelay={closeDelay}
      isDisabled={disabled}
    >
      {children}
    </TooltipTriggerPrimitive>
  )
}

export interface TooltipTriggerProps extends TriggerProps {}

/**
 * The element the tooltip describes. By default this is a Button, with
 * `asChild` the focusable child is used instead.
 */
export function TooltipTrigger(props: TooltipTriggerProps) {
  return <Trigger data-slot="tooltip-trigger" {...props} />
}

export interface TooltipContentProps
  extends StyleProps, DataProps, PositionProps {
  id?: string
  children: ReactNode
}

export function TooltipContent({
  side = 'top',
  align,
  sideOffset = 8,
  alignOffset,
  className,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive
      data-slot="tooltip-content"
      {...props}
      placement={placement(side, align)}
      offset={sideOffset}
      crossOffset={alignOffset}
      className={styles.TooltipContent(styler.merge({className}))}
    >
      <OverlayArrow className={styles.TooltipContent.arrow()}>
        {({placement}) => (
          <svg
            data-slot="tooltip-arrow"
            data-side={placement}
            className={styles.TooltipContent.arrow.icon()}
            width={8}
            height={8}
            viewBox="0 0 8 8"
          >
            <path d="M0 0 L4 4 L8 0" />
          </svg>
        )}
      </OverlayArrow>
      {children}
    </TooltipPrimitive>
  )
}
