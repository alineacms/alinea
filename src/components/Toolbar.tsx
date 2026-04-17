import styler from '@alinea/styler'
import type {
  GroupProps,
  SeparatorProps,
  ToggleButtonProps,
  ToolbarProps as ToolbarPrimitiveProps
} from 'react-aria-components'
import {
  Group,
  Separator,
  ToggleButton,
  Toolbar as ToolbarPrimitive
} from 'react-aria-components'
import css from './Toolbar.module.css'

const styles = styler(css)

export interface ToolbarProps extends Omit<ToolbarPrimitiveProps, 'children'> {
  children: React.ReactNode
}

export function Toolbar({className, ...props}: ToolbarProps) {
  return (
    <ToolbarPrimitive
      {...props}
      className={renderProps =>
        styles.Toolbar(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    />
  )
}

export function ToolbarGroup({isDisabled, className, ...props}: GroupProps) {
  return (
    <Group
      {...props}
      className={styles.ToolbarGroup(
        styler.merge({
          className: typeof className === 'string' ? className : undefined
        })
      )}
    >
      {props.children}
    </Group>
  )
}

export function ToolbarButton({...props}: ToggleButtonProps) {
  const {className, ...rest} = props
  return (
    <ToggleButton
      {...rest}
      className={renderProps =>
        styles.ToolbarButton(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    />
  )
}

export function ToolbarSeparator(props: SeparatorProps) {
  return <Separator {...props} className={styles.ToolbarSeparator()} />
}
