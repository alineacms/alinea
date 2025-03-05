import styler from '@alinea/styler'
import {HStack} from 'alinea/ui'
import {IcRoundAddCircle} from 'alinea/ui/icons/IcRoundAddCircle'
import {ComponentType, HTMLAttributes, HTMLProps} from 'react'
import {link} from '../util/HashRouter.js'
import css from './Create.module.scss'

const styles = styler(css)

export namespace Create {
  export interface RootProps extends HTMLAttributes<HTMLDivElement> {
    disabled?: boolean
  }
  export function Root({disabled, ...props}: RootProps) {
    return (
      <div {...props} className={styles.root.mergeProps(props)({disabled})} />
    )
  }

  export type Props = {
    icon?: ComponentType
    mod?: 'paste'
  }

  export function Link({
    children,
    icon: Icon,
    ...props
  }: HTMLProps<HTMLAnchorElement> & Props) {
    return (
      <a
        {...props}
        {...link(props.href)}
        className={styles.button.mergeProps(props)()}
      >
        <HStack center gap={8}>
          <IcRoundAddCircle style={{flexShrink: 0}} />
          {Icon && <Icon />}
          {children && <span>{children}</span>}
        </HStack>
      </a>
    )
  }

  export function Button({
    children,
    icon: Icon,
    mod,
    ...props
  }: HTMLAttributes<HTMLButtonElement> & Props) {
    return (
      <button
        type="button"
        {...props}
        className={styles.button.mergeProps(props)(mod)}
      >
        <HStack center gap={8}>
          {Icon ? (
            <div className={styles.button.add()}>
              <Icon />
            </div>
          ) : (
            <div className={styles.button.add()}>
              <IcRoundAddCircle />
            </div>
          )}

          {children && <span>{children}</span>}
        </HStack>
      </button>
    )
  }
}
