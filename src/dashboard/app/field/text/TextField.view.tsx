import {TextField as RacTextField} from '#/components.js'
import {TextField} from '#/field/text.js'
import {memo} from 'react'
import {useField, useFieldError, useFieldOptions} from '../../../store.js'

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
      label={options.label}
      value={value}
      onChange={setValue}
      isInvalid={Boolean(error)}
    />
  )
})
