import {TextField as RacTextField} from '@alinea/components'
import {TextField} from 'alinea/field/text'
import {
  useField,
  useFieldError,
  useFieldOptions
} from '../../dashboard/hooks.js'

export interface TextInputProps {
  field: TextField
}

export function TextFieldView({field}: TextInputProps) {
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
}
