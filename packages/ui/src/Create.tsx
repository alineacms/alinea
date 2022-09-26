import {ComponentType, HTMLAttributes, HTMLProps} from 'react'
import css from './Create.module.scss'
import {IcRoundAddCircle} from './icons/IcRoundAddCircle'
import {HStack} from './Stack'
import {link} from './util/HashRouter'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Create {
  export const Root = styles.root.toElement('div')

  export type Props = {
    icon?: ComponentType
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
    ...props
  }: HTMLAttributes<HTMLButtonElement> & Props) {
    return (
      <button
        type="button"
        {...props}
        className={styles.button.mergeProps(props)()}
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
