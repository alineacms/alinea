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
          <h2 slot="title" style={{margin: 0}}>
            {label}
          </h2>
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

export const dashboardModalStyles = styles
