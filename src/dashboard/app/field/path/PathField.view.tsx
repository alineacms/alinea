import {TextField as RacTextField} from '#/components.js'
import {PathField} from '#/field/path.js'
import {memo} from 'react'
import {useField, useFieldError, useFieldOptions} from '../../../store.js'

export interface TextInputProps {
  field: PathField
}

export const PathFieldView = memo(function PathFieldView({
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
