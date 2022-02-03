import {fromModule} from '@alinea/ui'
import {HTMLProps, PropsWithChildren} from 'react'
import css from './Modal.module.scss'

const styles = fromModule(css)

export type ModalProps = PropsWithChildren<{
  open: boolean
  onClose: () => void
}> &
  HTMLProps<HTMLDivElement>

export function Modal({children, open, onClose, ...props}: ModalProps) {
  return (
    <div
      role="dialog"
      aria-modal
      className={styles.root.mergeProps(props)({open})}
      {...props}
    >
      <div className={styles.root.background()} onClick={onClose}></div>
      <div className={styles.root.inner()}>{children}</div>
    </div>
  )
}
