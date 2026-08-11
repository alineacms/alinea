import styler from '@alinea/styler'
import type {DropZoneProps as DropPrimitiveZoneProps} from 'react-aria-components'
import {DropZone as DropPrimitiveZone} from 'react-aria-components'

import css from './DropZone.module.css'

const styles = styler(css)

export interface DropZoneProps extends DropPrimitiveZoneProps {}

export function DropZone(props: DropZoneProps) {
  const {className, ...rest} = props
  return (
    <DropPrimitiveZone
      {...rest}
      className={renderProps =>
        styles.DropZone(
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
