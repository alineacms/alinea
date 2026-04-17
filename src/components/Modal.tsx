import styler from '@alinea/styler'
import {
  type ModalOverlayProps,
  Modal as ModalPrimitive
} from 'react-aria-components'

import css from './Modal.module.css'

const styles = styler(css)

export function Modal(props: ModalOverlayProps) {
  const {className, ...rest} = props
  return (
    <ModalPrimitive
      {...rest}
      className={renderProps =>
        styles.Modal(
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
