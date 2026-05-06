import {TextField} from '#/components.js'
import {isSeparator, slugify} from '#/core/util/Slugs.js'
import {
  useField,
  useFieldError,
  useFieldOptions,
  useSiblingFieldValue
} from '#/dashboard/store.js'
import type {PathField} from '#/field/path.js'
import type {ReactNode} from 'react'
import {memo, useState} from 'react'

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
    <PathInput
      description={options.help}
      errorMessage={error}
      fieldValue={fieldValue}
      isInvalid={Boolean(error)}
      isReadOnly={options.readOnly}
      isRequired={options.required}
      label={options.label}
      source={source}
      onChange={setValue}
    />
  )
})

export interface PathInputProps {
  description?: ReactNode
  errorMessage?: ReactNode
  fieldValue?: string
  isInvalid?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  label?: ReactNode
  onChange: (value: string) => void
  source?: string
}

export function PathInput({
  description,
  errorMessage,
  fieldValue,
  isInvalid,
  isReadOnly,
  isRequired,
  label,
  onChange,
  source = ''
}: PathInputProps) {
  const [endsWithSeparator, setEndsWithSeparator] = useState(false)
  const value = fieldValue ?? slugify(source)
  const inputValue = value + (endsWithSeparator ? '-' : '')

  function handleChange(next: string) {
    setEndsWithSeparator(isSeparator(next.charAt(next.length - 1)))
    onChange(slugify(next))
  }

  function handleBlur() {
    setEndsWithSeparator(false)
  }

  return (
    <TextField
      description={description}
      errorMessage={errorMessage}
      isInvalid={isInvalid}
      isReadOnly={isReadOnly}
      isRequired={isRequired}
      label={label}
      onBlur={handleBlur}
      onChange={handleChange}
      value={inputValue}
    />
  )
}
