'use client'

import {Button, Dialog, Modal} from '#/components.js'
import styler from '@alinea/styler'
import {
  useContext,
  type ComponentProps,
  type PropsWithChildren,
  type ReactNode
} from 'react'
import {
  OverlayTriggerStateContext,
  type ModalOverlayProps
} from 'react-aria-components'
import {IcRoundClose} from '../../icons.js'
import {RailBody, RailFooter, RailHeader} from './Rail.js'
import css from './DashboardModal.module.css'

const styles = styler(css)

export interface DashboardModalProps extends ModalOverlayProps {
  size?: 'default' | 'explorer'
}

export function DashboardModal({size = 'default', ...props}: DashboardModalProps) {
  return (
    <Modal
      isDismissable
      className={styles.DashboardModal(size)}
      overlayClassName={styles.DashboardModalOverlay()}
      {...props}
    />
  )
}

export interface DashboardModalDialogProps
  extends PropsWithChildren,
    Omit<ComponentProps<typeof Dialog>, 'children' | 'className'> {
  label?: ReactNode
  controls?: ReactNode
  variant?: 'default' | 'explorer'
}

export function DashboardModalDialog({
  label,
  controls,
  children,
  variant = 'default',
  ...props
}: DashboardModalDialogProps) {
  return (
    <Dialog {...props} className={styles.DashboardModalDialog(variant)}>
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
    </Dialog>
  )
}

export function DashboardModalContent({children}: PropsWithChildren) {
  return <div className={styles.DashboardModalContent()}>{children}</div>
}

export function DashboardModalFooter({children}: PropsWithChildren) {
  return (
    <>
      <DashboardModalSeparator />
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
      appearance="outline"
      className={styles.DashboardModalCloseButton()}
      size="icon"
      type="button"
      onPress={close}
    >
      <IcRoundClose data-slot="icon" />
    </Button>
  )
}

export function DashboardModalSeparator() {
  return <div className={styles.DashboardModalSeparator()} />
}

export function DashboardModalExplorer(
  props: ComponentProps<'div'>
) {
  return (
    <div
      {...props}
      className={styles.DashboardModalExplorer(styler.merge(props))}
    />
  )
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

export interface DashboardModalExplorerFooterProps
  extends ComponentProps<typeof RailHeader> {}

export function DashboardModalExplorerFooter(
  props: DashboardModalExplorerFooterProps
) {
  return (
    <RailHeader
      {...props}
      className={styles.DashboardModalExplorerFooter(styler.merge(props))}
    />
  )
}

export interface DashboardModalExplorerSelectionProps
  extends ComponentProps<'span'> {}

export function DashboardModalExplorerSelection(
  props: DashboardModalExplorerSelectionProps
) {
  return (
    <span
      {...props}
      className={styles.DashboardModalExplorerSelection(styler.merge(props))}
    />
  )
}

export interface DashboardModalExplorerActionsProps
  extends ComponentProps<'div'> {}

export function DashboardModalExplorerActions(
  props: DashboardModalExplorerActionsProps
) {
  return (
    <div
      {...props}
      className={styles.DashboardModalExplorerActions(styler.merge(props))}
    />
  )
}

export interface DashboardModalFormHeaderProps
  extends ComponentProps<typeof RailHeader> {}

export function DashboardModalFormHeader(props: DashboardModalFormHeaderProps) {
  return (
    <RailHeader
      {...props}
      className={styles.DashboardModalFormHeader(styler.merge(props))}
    />
  )
}

export interface DashboardModalFormBodyProps
  extends ComponentProps<typeof RailBody> {}

export function DashboardModalFormBody(props: DashboardModalFormBodyProps) {
  return (
    <RailBody
      {...props}
      className={styles.DashboardModalFormBody(styler.merge(props))}
    />
  )
}

export interface DashboardModalFormFooterProps
  extends ComponentProps<typeof RailFooter> {}

export function DashboardModalFormFooter(props: DashboardModalFormFooterProps) {
  return (
    <RailFooter
      {...props}
      className={styles.DashboardModalFormFooter(styler.merge(props))}
    />
  )
}
