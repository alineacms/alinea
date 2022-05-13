import {Dialog} from '@headlessui/react'
import {ComponentPropsWithoutRef, PropsWithChildren} from 'react'
import {IconButton} from './IconButton'
import {IcRoundClose} from './icons/IcRoundClose'
import css from './Modal.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export type ModalProps = PropsWithChildren<
  {
    open: boolean
    onClose: () => void
    className?: string
  } & ComponentPropsWithoutRef<typeof Dialog>
>
export function Modal({children, ...props}: ModalProps) {
  return (
    <Dialog {...props} className={styles.root({open: props.open})}>
      <div className={styles.root.background()} onClick={props.onClose}></div>
      <Dialog.Panel className={styles.root.inner.mergeProps(props)()}>
        <IconButton
          className={styles.root.inner.close()}
          size={18}
          icon={IcRoundClose}
          onClick={props.onClose}
        />
        {children}
      </Dialog.Panel>
    </Dialog>
  )
}
