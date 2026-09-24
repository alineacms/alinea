import {TextField as TextFieldInput} from '#/components.js'
import {
  useField,
  useFieldError,
  useFieldNode,
  useFieldOptions
} from '#/dashboard/hooks.js'
import {TextField} from '#/field/text.js'
import {useSetAtom} from 'jotai'
import {memo} from 'react'

export interface TextInputProps {
  field: TextField
}

export const TextFieldView = memo(function TextFieldView({
  field
}: TextInputProps) {
  const [value = '', setValue] = useField(field)
  const fieldNode = useFieldNode(field)
  const setFieldNode = useSetAtom(fieldNode.value)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  return (
    <TextFieldInput
      autoFocus={options.autoFocus}
      description={options.help}
      error={error}
      disabled={options.readOnly}
      label={options.inline ? undefined : options.label}
      required={options.required}
      shared={options.shared}
      multiline={options.multiline}
      value={value}
      onValueChange={value => {
        setValue(value)
        setFieldNode(value)
      }}
      placeholder={
        options.placeholder ?? (options.inline ? options.label : undefined)
      }
      type={options.type}
      startIcon={options.iconLeft}
      endIcon={options.iconRight}
    />
  )
})
