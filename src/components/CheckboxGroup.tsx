import styler from '@alinea/styler'
import {
  CheckboxGroup as CheckboxGroupPrimitive,
  type CheckboxGroupProps as CheckboxPrimitiveGroupProps
} from 'react-aria-components'
import {Label, type LabelSharedProps, labelProps} from './Label.tsx'
import type {PropsWithChildren} from 'react'
import css from './CheckboxGroup.module.css'

const styles = styler(css)

export interface CheckboxGroupProps
  extends Omit<CheckboxPrimitiveGroupProps, 'children'>,
    LabelSharedProps {}

export function CheckboxGroup({
  children,
  className,
  ...props
}: PropsWithChildren<CheckboxGroupProps>) {
  return (
    <CheckboxGroupPrimitive {...props}>
      <Label {...labelProps(props)}>
        <div
          className={styles.CheckboxGroup(
            styler.merge({
              className: typeof className === 'string' ? className : undefined
            })
          )}
        >
          {children}
        </div>
      </Label>
    </CheckboxGroupPrimitive>
  )
}
