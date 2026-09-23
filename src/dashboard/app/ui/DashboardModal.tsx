'use client'

import {Button, Spinner, Surface} from '#/components.js'
import styler from '@alinea/styler'
import {
  useContext,
  type ComponentProps,
  type PropsWithChildren,
  type ReactNode
} from 'react'
import {
  Dialog,
  type DialogProps,
  Modal,
  ModalOverlay,
  type ModalOverlayProps,
  OverlayTriggerStateContext
} from 'react-aria-components'
import {IcRoundClose} from '../../icons.js'
import css from './DashboardModal.module.css'
import {RailBody, RailFooter, RailHeader} from './Rail.js'

const styles = styler(css)

export interface DashboardModalProps extends Omit<
  ModalOverlayProps,
  'children'
> {
  children?: ReactNode
  size?: 'default' | 'explorer'
}

export function DashboardModal({
  children,
  size = 'default',
  ...props
}: DashboardModalProps) {
  return (
    <ModalOverlay
      isDismissable
      {...props}
      className={styles.DashboardModalOverlay()}
    >
      <Modal className={styles.DashboardModal(size)}>
        <Surface className={styles.DashboardModal.surface()}>
          {children}
        </Surface>
      </Modal>
    </ModalOverlay>
  )
}

export interface DashboardModalDialogProps
  extends PropsWithChildren, Omit<DialogProps, 'children' | 'className'> {
  isLoading?: boolean
  label?: ReactNode
  controls?: ReactNode
  variant?: 'default' | 'explorer'
}

export function DashboardModalDialog({
  isLoading = false,
  label,
  controls,
  children,
  variant = 'default',
  ...props
}: DashboardModalDialogProps) {
  const loadingLabel =
    typeof props['aria-label'] === 'string'
      ? `Loading ${props['aria-label'].toLowerCase()}`
      : 'Loading'

  return (
    <Dialog
      {...props}
      className={styles.DashboardModalDialog(variant, {loading: isLoading})}
      data-loading={isLoading ? '' : undefined}
    >
      {isLoading ? (
        <Spinner
          aria-label={loadingLabel}
          className={styles.DashboardModalDialog.loader()}
        />
      ) : (
        <>
          {label !== undefined && (
            <header className={styles.DashboardModalDialog.header()}>
              <DashboardModalTitle>{label}</DashboardModalTitle>
              <DashboardModalCloseButton />
            </header>
          )}
          {controls && (
            <div className={styles.DashboardModalDialog.controls()}>
              {controls}
            </div>
          )}
          {children}
        </>
      )}
    </Dialog>
  )
}

export function DashboardModalContent({children}: PropsWithChildren) {
  return <div className={styles.DashboardModalContent()}>{children}</div>
}

export function DashboardModalFooter({children}: PropsWithChildren) {
  return (
    <>
      <footer className={styles.DashboardModalFooter()}>{children}</footer>
    </>
  )
}

export function DashboardModalTitle({children}: PropsWithChildren) {
  return (
    <h2 slot="title" className={styles.DashboardModalTitle()}>
      {children}
    </h2>
  )
}

export function useDashboardModal() {
  const ctx = useContext(OverlayTriggerStateContext)
  if (!ctx)
    throw new Error(
      'useDashboardModal must be used within a <DashboardModal> component'
    )
  return ctx
}

export function DashboardModalCloseButton() {
  const {close} = useDashboardModal()
  return (
    <Button
      aria-label="Close modal"
      variant="ghost"
      className={styles.DashboardModalCloseButton()}
      size="icon"
      type="button"
      onClick={close}
      icon={IcRoundClose}
    />
  )
}

export function DashboardModalSeparator() {
  return <div className={styles.DashboardModalSeparator()} />
}

export interface DashboardModalFormProps extends ComponentProps<'form'> {}

export function DashboardModalForm(props: DashboardModalFormProps) {
  return (
    <form
      {...props}
      className={styles.DashboardModalForm(styler.merge(props))}
    />
  )
}

export interface DashboardModalFormHeaderProps extends ComponentProps<
  typeof RailHeader
> {}

export function DashboardModalFormHeader(props: DashboardModalFormHeaderProps) {
  return (
    <RailHeader
      {...props}
      className={styles.DashboardModalFormHeader(styler.merge(props))}
    />
  )
}

export interface DashboardModalFormBodyProps extends ComponentProps<
  typeof RailBody
> {}

export function DashboardModalFormBody(props: DashboardModalFormBodyProps) {
  return (
    <RailBody
      {...props}
      className={styles.DashboardModalFormBody(styler.merge(props))}
    />
  )
}

export interface DashboardModalFormFooterProps extends ComponentProps<
  typeof RailFooter
> {}

export function DashboardModalFormFooter(props: DashboardModalFormFooterProps) {
  return (
    <RailFooter
      {...props}
      className={styles.DashboardModalFormFooter(styler.merge(props))}
    />
  )
}
