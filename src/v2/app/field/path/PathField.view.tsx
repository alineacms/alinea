import {TextField as RacTextField} from '@alinea/components'
import {PathField} from '#/field/path.js'
import {memo} from 'react'
import {useFieldError, useFieldOptions, useFieldValue} from '../../../store.js'

export interface TextInputProps {
  field: PathField
}

export const PathFieldView = memo(function PathFieldView({
  field
}: TextInputProps) {
  const [value = '', setValue] = useFieldValue(field)
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
