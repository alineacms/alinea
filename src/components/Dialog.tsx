import styler from '@alinea/styler'
import {
  Dialog as DialogPrimitive,
  type DialogProps
} from 'react-aria-components'

import css from './Dialog.module.css'

const styles = styler(css)

export function Dialog(props: DialogProps) {
  const {className, ...rest} = props
  return (
    <DialogPrimitive
      {...rest}
      className={styles.Dialog(
        styler.merge({
          className: typeof className === 'string' ? className : undefined
        })
      )}
    />
  )
}

export {DialogTrigger} from 'react-aria-components'
