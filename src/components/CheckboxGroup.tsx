import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {CheckboxGroup as CheckboxGroupPrimitive} from 'react-aria-components'
import css from './CheckboxGroup.module.css'
import {Field} from './Field.js'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  Orientation,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface CheckboxGroupProps
  extends FieldSharedProps, StyleProps, AriaProps, DataProps {
  value?: Array<string>
  defaultValue?: Array<string>
  onValueChange?: (value: Array<string>) => void
  orientation?: Orientation
  name?: string
  /** `Checkbox` elements, each with a `value` */
  children?: ReactNode
}

export function CheckboxGroup({
  label,
  description,
  error,
  required,
  disabled,
  readOnly,
  icon,
  shared,
  value,
  defaultValue,
  onValueChange,
  orientation = 'vertical',
  className,
  children,
  ...props
}: CheckboxGroupProps) {
  return (
    <CheckboxGroupPrimitive
      data-slot="checkbox-group"
      {...props}
      className={styles.CheckboxGroup(styler.merge({className}))}
      value={value}
      defaultValue={defaultValue}
      onChange={onValueChange}
      isRequired={required}
      isDisabled={disabled}
      isReadOnly={readOnly}
      isInvalid={error ? true : undefined}
    >
      <Field
        label={label}
        description={description}
        error={error}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        icon={icon}
        shared={shared}
      >
        <div
          data-slot="checkbox-group-items"
          data-orientation={orientation}
          className={styles.CheckboxGroup.items()}
        >
          {children}
        </div>
      </Field>
    </CheckboxGroupPrimitive>
  )
}
