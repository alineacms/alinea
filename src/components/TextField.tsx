import styler from '@alinea/styler'
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  type Ref,
  useState
} from 'react'
import {
  Input,
  TextArea,
  TextField as TextFieldPrimitive
} from 'react-aria-components'
import {Field} from './Field.js'
import {Icon} from './Icon.js'
import css from './TextField.module.css'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  IconType,
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
  /** Icon displayed inside the input, before the text */
  startIcon?: IconType | ReactElement
  /** Icon displayed inside the input, after the text */
  endIcon?: IconType | ReactElement
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
  startIcon,
  endIcon,
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
  const adornments = {start: Boolean(startIcon), end: Boolean(endIcon)}
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
        <div data-slot="text-field-group" className={styles.TextFieldGroup()}>
          {startIcon && (
            <Icon
              data-slot="text-field-start-icon"
              icon={startIcon}
              className={styles.TextFieldGroup.icon({start: true})}
            />
          )}
          {multiline ? (
            <div data-slot="text-field-grow" className={styles.TextFieldGrow()}>
              <TextArea
                data-slot="text-field-control"
                {...inputProps}
                {...control}
                rows={rows}
                className={styles.TextFieldControl(adornments)}
              />
              <div
                aria-hidden="true"
                className={styles.TextFieldControl({
                  ...adornments,
                  shadow: true
                })}
              >
                {`${current || placeholder || ''} `}
              </div>
            </div>
          ) : (
            <Input
              data-slot="text-field-control"
              {...inputProps}
              {...control}
              className={styles.TextFieldControl(adornments)}
            />
          )}
          {endIcon && (
            <Icon
              data-slot="text-field-end-icon"
              icon={endIcon}
              className={styles.TextFieldGroup.icon({end: true})}
            />
          )}
        </div>
      </Field>
    </TextFieldPrimitive>
  )
}
