import {
  useField,
  useFieldError,
  useFieldOptions,
  useSiblingFieldValue
} from '#/dashboard/hooks.js'
import type {PathField} from '#/field/path.js'
import {SlugField} from '#/field/path/SlugField.js'
import {memo} from 'react'

export interface PathFieldViewProps {
  field: PathField
}

export const PathFieldView = memo(function PathFieldView({
  field
}: PathFieldViewProps) {
  const [fieldValue, setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const sourceKey = options.from ?? 'title'
  const sourceValue = useSiblingFieldValue(sourceKey)
  const source = typeof sourceValue === 'string' ? sourceValue : ''

  return (
    <SlugField
      description={options.help}
      errorMessage={error}
      fieldValue={fieldValue}
      isInvalid={Boolean(error)}
      isReadOnly={options.readOnly}
      isRequired={options.required}
      label={options.label}
      shared={options.shared}
      source={source}
      onChange={setValue}
    />
  )
})
