import styler from '@alinea/styler'
import {
  Checkbox as CheckboxPrimitive,
  type CheckboxProps as CheckboxPrimitiveProps
} from 'react-aria-components'
import css from './Checkbox.module.css'
import {DescriptionLabel} from './DescriptionLabel.js'

const styles = styler(css)

export type {CheckboxProps} from 'react-aria-components'

interface CheckboxProps extends CheckboxPrimitiveProps {
  label?: string
  description?: string
}

export function Checkbox({
  label,
  description,
  children,
  ...props
}: CheckboxProps) {
  const {className, ...rest} = props
  return (
    <CheckboxPrimitive
      {...rest}
      className={renderProps =>
        styles.Checkbox(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      {({isIndeterminate}) => (
        <>
          <div className={styles.Checkbox.box()}>
            <svg
              className={styles.Checkbox.mark()}
              viewBox="0 0 18 18"
              aria-hidden="true"
            >
              {isIndeterminate ? (
                <rect x={1} y={7.5} width={15} height={3} />
              ) : (
                <polyline points="1 9 7 14 15 4" />
              )}
            </svg>
          </div>
          {label || children}
          {description && <DescriptionLabel description={description} />}
        </>
      )}
    </CheckboxPrimitive>
  )
}
