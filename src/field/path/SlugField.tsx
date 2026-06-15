import {TextField} from '#/components.js'
import {isSeparator, slugify} from '#/core/util/Slugs.js'
import type {ReactNode} from 'react'
import {useState} from 'react'

export interface SlugFieldProps {
  description?: ReactNode
  errorMessage?: ReactNode
  fieldValue?: string
  isDisabled?: boolean
  isInvalid?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  label?: ReactNode
  shared?: boolean
  onChange: (value: string) => void
  source?: string
}

export function SlugField({
  description,
  errorMessage,
  fieldValue,
  isDisabled,
  isInvalid,
  isReadOnly,
  isRequired,
  label,
  shared,
  onChange,
  source = ''
}: SlugFieldProps) {
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
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      isReadOnly={isReadOnly}
      isRequired={isRequired}
      label={label}
      shared={shared}
      onBlur={handleBlur}
      onChange={handleChange}
      value={inputValue}
    />
  )
}
