import styler from '@alinea/styler'
import {type FocusEvent, type KeyboardEvent, type Ref, useState} from 'react'
import {
  Input,
  TextArea,
  TextField as TextFieldPrimitive
} from 'react-aria-components'
import {Field} from './Field.js'
import css from './TextField.module.css'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  StyleProps
} from './types.js'

const styles = styler(css)

type TextFieldElement = HTMLInputElement | HTMLTextAreaElement

export interface TextFieldProps
  extends FieldSharedProps, StyleProps, AriaProps, DataProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  type?: 'text' | 'email' | 'url' | 'password' | 'tel' | 'search'
  /** Render a textarea that grows with its content */
  multiline?: boolean
  /** Minimum number of rows of a multiline field */
  rows?: number
  name?: string
  autoFocus?: boolean
  autoComplete?: string
  maxLength?: number
  minLength?: number
  onBlur?: (event: FocusEvent<TextFieldElement>) => void
  onFocus?: (event: FocusEvent<TextFieldElement>) => void
  onKeyDown?: (event: KeyboardEvent<TextFieldElement>) => void
  /** Extra data attributes for the input element */
  inputProps?: DataProps
  ref?: Ref<HTMLDivElement>
}

export function TextField({
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
  placeholder,
  type = 'text',
  multiline,
  rows = 1,
  autoComplete,
  maxLength,
  minLength,
  onBlur,
  onFocus,
  onKeyDown,
  inputProps,
  className,
  style,
  ...props
}: TextFieldProps) {
  const controlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue ?? '')
  const [wasControlled, setWasControlled] = useState(controlled)
  if (wasControlled !== controlled) {
    // Switching between controlled and uncontrolled starts from an empty
    // value rather than text typed during an earlier uncontrolled phase
    setWasControlled(controlled)
    setInternal('')
  }
  const current = controlled ? value : internal
  const control = {
    placeholder,
    autoComplete,
    maxLength,
    minLength,
    onBlur,
    onFocus,
    onKeyDown
  }
  return (
    <TextFieldPrimitive
      data-slot="text-field"
      {...props}
      value={current}
      onChange={next => {
        setInternal(next)
        onValueChange?.(next)
      }}
      type={multiline ? undefined : type}
      isRequired={required}
      isDisabled={disabled}
      isReadOnly={readOnly}
      isInvalid={Boolean(error)}
      className={styles.TextField(styler.merge({className}))}
      style={style}
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
        {multiline ? (
          <div data-slot="text-field-grow" className={styles.TextFieldGrow()}>
            <TextArea
              data-slot="text-field-control"
              {...inputProps}
              {...control}
              rows={rows}
              className={styles.TextFieldControl()}
            />
            <div
              aria-hidden="true"
              className={styles.TextFieldControl({shadow: true})}
            >
              {`${current || placeholder || ''} `}
            </div>
          </div>
        ) : (
          <Input
            data-slot="text-field-control"
            {...inputProps}
            {...control}
            className={styles.TextFieldControl()}
          />
        )}
      </Field>
    </TextFieldPrimitive>
  )
}
