import {HTMLProps, PropsWithChildren} from 'react'
import {MdClose} from 'react-icons/md'
import {IconButton} from './IconButton'
import css from './Modal.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export type ModalProps = PropsWithChildren<{
  open: boolean
  onClose: () => void
}> &
  HTMLProps<HTMLDivElement>

// Todo: for accessibility's sake we should use a tried and tested library here
export function Modal({children, open, onClose, ...props}: ModalProps) {
  return (
    <div
      role="dialog"
      aria-modal
      className={styles.root.mergeProps(props)({open})}
      {...props}
    >
      <div className={styles.root.background()} onClick={onClose}></div>
      <div className={styles.root.inner()}>
        <IconButton
          className={styles.root.inner.close()}
          size={18}
          icon={MdClose}
          onClick={onClose}
        />
        {children}
      </div>
    </div>
  )
}
