import styler from '@alinea/styler'
import {type ComponentPropsWithoutRef, type ReactNode, useContext} from 'react'
import {
  Dialog as DialogPrimitive,
  DialogTrigger as DialogTriggerPrimitive,
  Heading,
  Modal,
  ModalOverlay,
  OverlayTriggerStateContext
} from 'react-aria-components'
import {IcRoundClose} from '../dashboard/icons.js'
import {Button, type ButtonProps} from './Button.js'
import css from './Dialog.module.css'
import {Slot} from './internal/Slot.js'
import {Trigger, type TriggerProps} from './internal/Trigger.js'
import type {AriaProps, DataProps, OpenStateProps, StyleProps} from './types.js'

const styles = styler(css)

export interface DialogProps extends OpenStateProps {
  children: ReactNode
}

export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  children
}: DialogProps) {
  return (
    <DialogTriggerPrimitive
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </DialogTriggerPrimitive>
  )
}

export interface DialogTriggerProps extends TriggerProps {}

export function DialogTrigger(props: DialogTriggerProps) {
  return <Trigger data-slot="dialog-trigger" {...props} />
}

export interface DialogContentProps extends StyleProps, AriaProps, DataProps {
  role?: 'dialog' | 'alertdialog'
  /** Close the dialog when clicking outside of it, defaults to true */
  dismissable?: boolean
  /** Defaults to true */
  showCloseButton?: boolean
  children: ReactNode
}

export function DialogContent({
  role,
  dismissable = true,
  showCloseButton = true,
  className,
  style,
  children,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  ...props
}: DialogContentProps) {
  return (
    <ModalOverlay
      isDismissable={dismissable}
      className={styles.DialogOverlay()}
    >
      <Modal
        data-slot="dialog-content"
        {...props}
        className={styles.DialogContent(styler.merge({className}))}
        style={style}
      >
        <DialogPrimitive
          id={id}
          role={role}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          aria-describedby={ariaDescribedby}
          className={styles.DialogContent.dialog()}
        >
          {children}
          {showCloseButton && (
            <DialogClose
              aria-label="Close"
              variant="ghost"
              size="icon"
              icon={IcRoundClose}
              className={styles.DialogContent.close()}
            />
          )}
        </DialogPrimitive>
      </Modal>
    </ModalOverlay>
  )
}

export interface DialogHeaderProps extends ComponentPropsWithoutRef<'div'> {}

export function DialogHeader({className, ...props}: DialogHeaderProps) {
  return (
    <div
      data-slot="dialog-header"
      {...props}
      className={styles.DialogHeader(styler.merge({className}))}
    />
  )
}

export interface DialogFooterProps extends ComponentPropsWithoutRef<'div'> {}

export function DialogFooter({className, ...props}: DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      {...props}
      className={styles.DialogFooter(styler.merge({className}))}
    />
  )
}

export interface DialogTitleProps extends StyleProps {
  children: ReactNode
}

export function DialogTitle({className, ...props}: DialogTitleProps) {
  return (
    <Heading
      data-slot="dialog-title"
      slot="title"
      level={2}
      {...props}
      className={styles.DialogTitle(styler.merge({className}))}
    />
  )
}

export interface DialogDescriptionProps extends ComponentPropsWithoutRef<'p'> {}

export function DialogDescription({
  className,
  ...props
}: DialogDescriptionProps) {
  return (
    <p
      data-slot="dialog-description"
      {...props}
      className={styles.DialogDescription(styler.merge({className}))}
    />
  )
}

export interface DialogCloseProps extends ButtonProps {}

/** Closes the surrounding Dialog or Popover when pressed */
export function DialogClose({asChild, onClick, ...props}: DialogCloseProps) {
  const state = useContext(OverlayTriggerStateContext)
  const close = () => state?.close()
  if (asChild) return <Slot onClick={close}>{props.children}</Slot>
  return (
    <Button
      data-slot="dialog-close"
      {...props}
      onClick={event => {
        onClick?.(event)
        close()
      }}
    />
  )
}
