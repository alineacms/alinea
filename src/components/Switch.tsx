import styler from '@alinea/styler'
import {
  Switch as AriaSwitch,
  type SwitchProps as AriaSwitchProps
} from 'react-aria-components'
import css from './Switch.module.css'

const styles = styler(css)

export interface SwitchProps extends Omit<AriaSwitchProps, 'children'> {
  children: React.ReactNode
}

export function Switch({children, ...props}: SwitchProps) {
  const {className, ...rest} = props
  return (
    <AriaSwitch
      {...rest}
      className={renderProps =>
        styles.Switch(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      <div className={styles.Switch.track()} />
      {children}
    </AriaSwitch>
  )
}
