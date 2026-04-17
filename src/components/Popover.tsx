import styler from '@alinea/styler'
import {
  type PopoverProps as AriaPopoverProps,
  Popover as PopoverPrimitive
} from 'react-aria-components'
import css from './Popover.module.css'

const styles = styler(css)

export interface PopoverProps extends Omit<AriaPopoverProps, 'children'> {
  children: React.ReactNode
}

export function Popover({children, ...props}: PopoverProps) {
  const {className, ...rest} = props
  return (
    <PopoverPrimitive
      {...rest}
      className={renderProps =>
        styles.Popover(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      {children}
    </PopoverPrimitive>
  )
}
