import {ComponentType, HTMLAttributes} from 'react'
import {MdAddCircle} from 'react-icons/md'
import {Link as RRLink, LinkProps} from 'react-router-dom'
import css from './Create.module.scss'
import {HStack} from './Stack'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Create {
  export const Root = styles.root.toElement('div')

  export type Props = {
    icon?: ComponentType
  }

  export function Link({children, icon: Icon, ...props}: LinkProps & Props) {
    return (
      <RRLink {...props} className={styles.button.mergeProps(props)()}>
        <HStack center gap={8}>
          <MdAddCircle style={{flexShrink: 0}} />
          {children && <span>{children}</span>}
          {Icon && <Icon />}
        </HStack>
      </RRLink>
    )
  }

  export function Button({
    children,
    icon: Icon,
    ...props
  }: HTMLAttributes<HTMLButtonElement> & Props) {
    return (
      <button {...props} className={styles.button.mergeProps(props)()}>
        <HStack center gap={8}>
          <MdAddCircle style={{flexShrink: 0}} />
          {children && <span>{children}</span>}
          {Icon && <Icon />}
        </HStack>
      </button>
    )
  }
}
