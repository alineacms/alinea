import type {ComponentProps} from 'react'
import styler from '@alinea/styler'
import {
  Modal as ModalPrimitive,
  ModalOverlay as ModalOverlayPrimitive
} from 'react-aria-components'

import css from './Modal.module.css'

const styles = styler(css)

export interface ModalProps
  extends
    Omit<ComponentProps<typeof ModalOverlayPrimitive>, 'children'>,
    Omit<ComponentProps<typeof ModalPrimitive>, 'children'> {
  children?: ComponentProps<typeof ModalPrimitive>['children']
  overlayClassName?: ComponentProps<typeof ModalOverlayPrimitive>['className']
}

export function Modal(props: ModalProps) {
  const {children, className, overlayClassName, ...rest} = props
  return (
    <ModalOverlayPrimitive
      {...rest}
      className={renderProps =>
        styles.ModalOverlay(
          styler.merge({
            className:
              typeof overlayClassName === 'function'
                ? overlayClassName(renderProps)
                : overlayClassName
          })
        )
      }
    >
      <ModalPrimitive
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
      >
        {children}
      </ModalPrimitive>
    </ModalOverlayPrimitive>
  )
}
