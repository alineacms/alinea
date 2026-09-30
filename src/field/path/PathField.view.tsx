import {slugify} from '#/core/util/Slugs.js'
import {fieldError} from '#/core/Validation.js'
import {
  useField,
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
  const sourceKey = options.from ?? 'title'
  const sourceValue = useSiblingFieldValue(sourceKey)
  const source = typeof sourceValue === 'string' ? sourceValue : ''
  // A path that was not edited follows its source, like it is validated and
  // saved
  const error = fieldError(field, options, fieldValue ?? slugify(source))

  return (
    <SlugField
      description={options.help}
      errorMessage={error}
      fieldValue={fieldValue}
      isReadOnly={options.readOnly}
      isRequired={options.required}
      label={options.label}
      shared={options.shared}
      source={source}
      onChange={setValue}
    />
  )
})
