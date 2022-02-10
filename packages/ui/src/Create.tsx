import {HTMLAttributes} from 'react'
import {MdAddCircle} from 'react-icons/md'
import {Link as RRLink, LinkProps} from 'react-router-dom'
import css from './Create.module.scss'
import {HStack} from './Stack'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Create {
  export const Root = styles.root.toElement('div')

  export function Link({children, ...props}: LinkProps) {
    return (
      <RRLink {...props} className={styles.button.mergeProps(props)()}>
        <HStack center gap={8}>
          <MdAddCircle />
          {children && <span>{children}</span>}
        </HStack>
      </RRLink>
    )
  }

  export function Button({
    children,
    ...props
  }: HTMLAttributes<HTMLButtonElement>) {
    return (
      <button {...props} className={styles.button.mergeProps(props)()}>
        <HStack center gap={8}>
          <MdAddCircle />
          {children && <span>{children}</span>}
        </HStack>
      </button>
    )
  }
}
