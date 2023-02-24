import {Dialog} from '@headlessui/react'
import {ComponentPropsWithoutRef, PropsWithChildren, useRef} from 'react'
import {IconButton} from './IconButton.js'
import css from './Modal.module.scss'
import {IcRoundClose} from './icons/IcRoundClose.js'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export type ModalProps = PropsWithChildren<
  {
    open: boolean
    onClose: () => void
    className?: string
  } & ComponentPropsWithoutRef<typeof Dialog>
>
export function Modal({children, ...props}: ModalProps) {
  const modalRef = useRef(null)

  return (
    <Dialog
      {...props}
      ref={modalRef}
      initialFocus={modalRef}
      className={styles.root({open: props.open})}
    >
      <div className={styles.root.background()} onClick={props.onClose}></div>
      <Dialog.Panel className={styles.root.inner.mergeProps(props)()}>
        {children}
        <IconButton
          className={styles.root.inner.close()}
          size={18}
          icon={IcRoundClose}
          onClick={props.onClose}
        />
      </Dialog.Panel>
    </Dialog>
  )
}
