'use client'

import {Button, Dialog, Modal} from '@alinea/components'
import styler from '@alinea/styler'
import {useContext, type PropsWithChildren, type ReactNode} from 'react'
import {
  OverlayTriggerStateContext,
  type ModalOverlayProps
} from 'react-aria-components'
import {IcRoundClose} from '../../icons.js'
import css from './Sheet.module.css'

const styles = styler(css)

export interface SheetProps extends ModalOverlayProps {}

export function Sheet(props: ModalOverlayProps) {
  return <Modal isDismissable className={styles.Sheet()} {...props} />
}

export interface SheetDialogProps extends PropsWithChildren {
  label?: ReactNode
  controls?: ReactNode
}

export function SheetDialog({label, controls, children}: SheetDialogProps) {
  return (
    <Dialog className={styles.SheetDialog()}>
      <header className={styles.SheetDialog.header()}>
        <h2 slot="title" style={{margin: 0}}>
          {label}
        </h2>
        <CloseButton />
      </header>
      {controls && <div className={styles.SheetDialog.controls()}>{controls}</div>}
      {/*<SheetSeparator />*/}
      {children}
    </Dialog>
  )
}

export function SheetContent({children}: PropsWithChildren) {
  return <div className={styles.SheetContent()}>{children}</div>
}

export function SheetFooter({children}: PropsWithChildren) {
  return (
    <>
      <SheetSeparator />
      <footer className={styles.SheetFooter()}>{children}</footer>
    </>
  )
}

export function useSheet() {
  const ctx = useContext(OverlayTriggerStateContext)
  if (!ctx) throw new Error('useSheet must be used within a <Sheet> component')
  return ctx
}

function CloseButton() {
  const {close} = useSheet()
  return (
    <Button size="square-petite" appearance="plain" onPress={close}>
      <IcRoundClose data-slot="icon" />
    </Button>
  )
}

export function SheetSeparator() {
  return <div className={styles.SheetSeparator()} />
}
