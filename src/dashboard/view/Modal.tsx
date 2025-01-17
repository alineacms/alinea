import styler from '@alinea/styler'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {PropsWithChildren, useRef} from 'react'
import {createPortal} from 'react-dom'
import css from './Modal.module.scss'

const styles = styler(css)

let modalTarget: Element | null = null

export type ModalProps = PropsWithChildren<{
  open?: boolean
  onClose: () => void
  className?: string
}>

export function Modal({children, ...props}: ModalProps) {
  const modalRef = useRef(null)
  if (!props.open) return null
  const inner = (
    <div {...props} ref={modalRef} className={styles.root({open: props.open})}>
      <div className={styles.root.background()} onClick={props.onClose}></div>
      <div className={styles.root.inner.mergeProps(props)()}>
        {children}
        <IconButton
          className={styles.root.inner.close()}
          size={18}
          icon={IcRoundClose}
          onClick={props.onClose}
        />
      </div>
    </div>
  )
  if (!modalTarget) return inner
  return createPortal(inner, modalTarget)
}

export function ModalPortal() {
  return (
    <div
      ref={(element: Element | null) => {
        modalTarget = element
      }}
    />
  )
}
