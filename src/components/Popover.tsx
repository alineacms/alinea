import styler from '@alinea/styler'
import {createContext, type ReactNode, useContext} from 'react'
import {Dialog, DialogTrigger} from 'react-aria-components'
import {placement} from './internal/Placement.js'
import {PopoverSurface} from './internal/PopoverSurface.js'
import {Trigger, type TriggerProps} from './internal/Trigger.js'
import css from './Popover.module.css'
import type {
  AriaProps,
  DataProps,
  OpenStateProps,
  PositionProps,
  StyleProps
} from './types.js'

const styles = styler(css)

const PopoverModalContext = createContext(true)

export interface PopoverProps extends OpenStateProps {
  /**
   * Whether interaction outside the popover is blocked while it is open.
   * Defaults to true.
   */
  modal?: boolean
  children: ReactNode
}

export function Popover({
  open,
  defaultOpen,
  onOpenChange,
  modal = true,
  children
}: PopoverProps) {
  return (
    <PopoverModalContext.Provider value={modal}>
      <DialogTrigger
        isOpen={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
      >
        {children}
      </DialogTrigger>
    </PopoverModalContext.Provider>
  )
}

export interface PopoverTriggerProps extends TriggerProps {}

export function PopoverTrigger(props: PopoverTriggerProps) {
  return <Trigger data-slot="popover-trigger" {...props} />
}

export interface PopoverContentProps
  extends StyleProps, AriaProps, DataProps, PositionProps {
  children: ReactNode
}

export function PopoverContent({
  side,
  align,
  sideOffset,
  alignOffset,
  className,
  style,
  children,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  ...props
}: PopoverContentProps) {
  const modal = useContext(PopoverModalContext)
  return (
    <PopoverSurface
      data-slot="popover-content"
      {...props}
      className={styles.PopoverContent(styler.merge({className}))}
      style={style}
      placement={placement(side, align)}
      offset={sideOffset}
      crossOffset={alignOffset}
      isNonModal={!modal}
    >
      <Dialog
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        className={styles.PopoverContent.dialog()}
      >
        {children}
      </Dialog>
    </PopoverSurface>
  )
}
