'use client'

import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  PageContent,
  PageFooter,
  PageHeader,
  Spinner,
  type PageContentProps,
  type PageFooterProps,
  type PageHeaderProps,
  Surface,
  useDialog
} from '#/components.js'
import styler from '@alinea/styler'
import {
  createContext,
  useContext,
  type ComponentProps,
  type PropsWithChildren,
  type ReactNode
} from 'react'
import {IcRoundClose} from '../../icons.js'
import css from './DashboardModal.module.css'

const styles = styler(css)

const DashboardModalLabel = createContext<string | undefined>(undefined)

export interface DashboardModalProps {
  /**
   * Controls the modal on its own. Leave out to render it as the content of
   * a surrounding Dialog.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Close the modal when clicking outside of it, defaults to true */
  dismissable?: boolean
  /** Labels the modal, a DashboardModalTitle labels it otherwise */
  'aria-label'?: string
  children?: ReactNode
  size?: 'default' | 'explorer'
}

export function DashboardModal({
  open,
  onOpenChange,
  dismissable = true,
  'aria-label': ariaLabel,
  children,
  size = 'default'
}: DashboardModalProps) {
  const content = (
    <DialogContent
      size={size === 'explorer' ? 'full' : 'lg'}
      dismissable={dismissable}
      showCloseButton={false}
      aria-label={ariaLabel}
      className={styles.DashboardModal()}
    >
      <DashboardModalLabel.Provider value={ariaLabel}>
        <Surface className={styles.DashboardModal.surface()}>
          {children}
        </Surface>
      </DashboardModalLabel.Provider>
    </DialogContent>
  )
  if (open === undefined) return content
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {content}
    </Dialog>
  )
}

export interface DashboardModalDialogProps extends PropsWithChildren {
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
  variant = 'default'
}: DashboardModalDialogProps) {
  const ariaLabel = useContext(DashboardModalLabel)
  const loadingLabel = ariaLabel
    ? `Loading ${ariaLabel.toLowerCase()}`
    : 'Loading'
  return (
    <div
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
    </div>
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
    <DialogTitle className={styles.DashboardModalTitle()}>
      {children}
    </DialogTitle>
  )
}

export function DashboardModalCloseButton() {
  const {close} = useDialog()
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

export interface DashboardModalFormHeaderProps extends PageHeaderProps {}

export function DashboardModalFormHeader(props: DashboardModalFormHeaderProps) {
  return (
    <PageHeader
      {...props}
      className={styles.DashboardModalFormHeader(styler.merge(props))}
    />
  )
}

export interface DashboardModalFormBodyProps extends PageContentProps {}

export function DashboardModalFormBody(props: DashboardModalFormBodyProps) {
  return (
    <PageContent
      {...props}
      className={styles.DashboardModalFormBody(styler.merge(props))}
    />
  )
}

export interface DashboardModalFormFooterProps extends PageFooterProps {}

export function DashboardModalFormFooter(props: DashboardModalFormFooterProps) {
  return (
    <PageFooter
      {...props}
      className={styles.DashboardModalFormFooter(styler.merge(props))}
    />
  )
}
