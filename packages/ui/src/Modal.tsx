import ReactModal from 'react-modal'
import {IconButton} from './IconButton'
import {IcRoundClose} from './icons/IcRoundClose'
import css from './Modal.module.scss'
import {fromModule} from './util/Styler'
import {useViewport} from './Viewport'

const styles = fromModule(css)

export type ModalProps = Omit<ReactModal.Props, 'isOpen' | 'onRequestClose'> & {
  open: boolean
  onClose: () => void
}

// Todo: for accessibility's sake we should use a tried and tested library here
export function Modal({open, onClose, children, ...props}: ModalProps) {
  const modalContainer = useViewport()
  if (!modalContainer) return null

  return (
    <ReactModal
      {...props}
      isOpen={open}
      onRequestClose={onClose}
      ariaHideApp={false}
      closeTimeoutMS={150}
      parentSelector={() => modalContainer}
      portalClassName={styles.root()}
      overlayClassName={styles.root.background()}
      className={styles.root.inner()}
    >
      {children}
      <IconButton
        className={styles.root.inner.close()}
        size={18}
        icon={IcRoundClose}
        onClick={onClose}
      />
    </ReactModal>
  )
}
