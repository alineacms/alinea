import styler from '@alinea/styler'
import {
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
  useContext
} from 'react'
import {
  Dialog as DialogPrimitive,
  DialogTrigger as DialogTriggerPrimitive,
  Heading,
  Modal,
  ModalOverlay,
  OverlayTriggerStateContext
} from 'react-aria-components'
import {IcRoundClose} from '#/dashboard/icons.js'
import {Button, type ButtonProps} from './Button.js'
import css from './Dialog.module.css'
import {Form, type FormProps, type FormSubmitResult} from './Form.js'
import {Slot, type SlotProps} from './internal/Slot.js'
import {
  OptionalTrigger,
  Trigger,
  type TriggerProps
} from './internal/Trigger.js'
import type {
  AriaProps,
  DataProps,
  OpenStateProps,
  StyleProps,
  ValidationErrors
} from './types.js'

const styles = styler(css)

export interface DialogProps extends OpenStateProps {
  /** Called when the dialog closes, after `onOpenChange(false)` */
  onClose?: () => void
  children: ReactNode
}

export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  onClose,
  children
}: DialogProps) {
  return (
    <DialogTriggerPrimitive
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={next => {
        onOpenChange?.(next)
        if (!next) onClose?.()
      }}
    >
      <OptionalTrigger />
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
  /**
   * `default` fits its content up to a narrow width, `lg` is a fixed wide
   * dialog and `full` fills the viewport (minus a margin), defaults to
   * `default`
   */
  size?: 'default' | 'lg' | 'full'
  /** Close the dialog when clicking outside of it, defaults to true */
  dismissable?: boolean
  /** Defaults to true */
  showCloseButton?: boolean
  /**
   * Renders the content as a Form, submitted by a `type="submit"` Button.
   * The dialog closes once this resolves without returning errors, which
   * are shown on the fields otherwise.
   */
  onSubmit?: FormProps['onSubmit']
  /** Errors keyed by field name, when the content is a form */
  validationErrors?: ValidationErrors
  children: ReactNode
}

export function DialogContent({
  role,
  size = 'default',
  dismissable = true,
  showCloseButton = true,
  onSubmit,
  validationErrors,
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
      data-slot="dialog-overlay"
      // Dialogs render outside the page, they need the theme of their own
      data-alinea-theme=""
      isDismissable={dismissable}
      className={styles.DialogContent.overlay()}
    >
      <Modal
        data-slot="dialog-content"
        data-size={size}
        {...props}
        className={styles.DialogContent(styler.merge({className}))}
        style={style}
      >
        <DialogPrimitive
          data-slot="dialog-body"
          id={id}
          role={role}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          aria-describedby={ariaDescribedby}
          className={styles.DialogContent.dialog()}
        >
          {onSubmit ? (
            <DialogForm onSubmit={onSubmit} validationErrors={validationErrors}>
              {children}
            </DialogForm>
          ) : (
            children
          )}
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

interface DialogFormProps {
  onSubmit: NonNullable<FormProps['onSubmit']>
  validationErrors?: ValidationErrors
  children: ReactNode
}

function DialogForm({onSubmit, validationErrors, children}: DialogFormProps) {
  const state = useContext(OverlayTriggerStateContext)
  async function submit(data: FormData): Promise<FormSubmitResult> {
    const errors = await onSubmit(data)
    if (!errors || Object.keys(errors).length === 0) state?.close()
    return errors
  }
  return (
    <Form
      validationErrors={validationErrors}
      onSubmit={submit}
      className={styles.DialogContent.form()}
    >
      {children}
    </Form>
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

export interface DialogState {
  /** Whether the surrounding Dialog or Popover is open */
  open: boolean
  close(): void
}

/**
 * The open state of the surrounding Dialog or Popover, to close it from
 * within its content
 */
export function useDialog(): DialogState {
  const state = useContext(OverlayTriggerStateContext)
  if (!state) throw new Error('useDialog must be used within a Dialog')
  return {open: state.isOpen, close: () => state.close()}
}

export interface DialogCloseProps extends ButtonProps {}

/** Closes the surrounding Dialog or Popover when pressed */
export function DialogClose({
  asChild,
  onClick,
  children,
  ...props
}: DialogCloseProps) {
  const state = useContext(OverlayTriggerStateContext)
  function close(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event)
    state?.close()
  }
  if (asChild)
    return (
      <Slot
        data-slot="dialog-close"
        {...(props as SlotProps)}
        onClick={close as SlotProps['onClick']}
      >
        {children}
      </Slot>
    )
  return (
    <Button data-slot="dialog-close" {...props} onClick={close}>
      {children}
    </Button>
  )
}
