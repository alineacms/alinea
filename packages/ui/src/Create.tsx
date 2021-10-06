import {HTMLAttributes} from 'react'
import {MdAddCircle} from 'react-icons/md/index'
import css from './Create.module.scss'
import {HStack} from './Stack'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Create {
  export const Root = styles.root.toElement('div')

  export function Button({
    children,
    ...props
  }: HTMLAttributes<HTMLButtonElement>) {
    return (
      <button {...props} className={styles.button.mergeProps(props)()}>
        <HStack center gap={4}>
          <MdAddCircle />
          <span>{children}</span>
        </HStack>
      </button>
    )
  }
}
