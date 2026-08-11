import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {
  Checkbox as CheckboxPrimitive,
  type CheckboxProps as CheckboxPrimitiveProps
} from 'react-aria-components'
import css from './Checkbox.module.css'
import {LabelDescription, LabelLabel, LabelStack} from './Label.js'

const styles = styler(css)

export type {CheckboxProps} from 'react-aria-components'

interface CheckboxProps extends Omit<CheckboxPrimitiveProps, 'children'> {
  children?: ReactNode
  label?: ReactNode
  description?: ReactNode
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
          <LabelStack>
            <LabelLabel
              asLabel={false}
              label={label}
              tone="inherit"
              weight="normal"
            >
              {children}
            </LabelLabel>
            {description && (
              <LabelDescription description={description} size="small" />
            )}
          </LabelStack>
        </>
      )}
    </CheckboxPrimitive>
  )
}
