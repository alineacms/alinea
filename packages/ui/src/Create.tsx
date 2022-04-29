import {ComponentType, HTMLAttributes} from 'react'
import {Link as RRLink, LinkProps} from 'react-router-dom'
import css from './Create.module.scss'
import {IcRoundAdd} from './icons/IcRoundAdd'
import {IcRoundAddCircle} from './icons/IcRoundAddCircle'
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
          <IcRoundAddCircle style={{flexShrink: 0}} />
          {Icon && <Icon />}
          {children && <span>{children}</span>}
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
          {Icon ? (
            <div className={styles.button.add()}>
              <Icon />
            </div>
          ) : (
            <div className={styles.button.add()}>
              <IcRoundAdd />
            </div>
          )}

          {children && <span>{children}</span>}
        </HStack>
      </button>
    )
  }
}
