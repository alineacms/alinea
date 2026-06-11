import {TextField as RacTextField} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import {TextField} from '#/field/text.js'
import {memo} from 'react'

export interface TextInputProps {
  field: TextField
}

export const TextFieldView = memo(function TextFieldView({
  field
}: TextInputProps) {
  const [value = '', setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  return (
    <RacTextField
      autoFocus={options.autoFocus}
      description={options.help}
      errorMessage={error}
      isDisabled={options.readOnly}
      label={options.label}
      isRequired={options.required}
      shared={options.shared}
      multiline={options.multiline}
      value={value}
      onChange={setValue}
      isInvalid={Boolean(error)}
      placeholder={options.placeholder}
      type={options.type}
    />
  )
})
