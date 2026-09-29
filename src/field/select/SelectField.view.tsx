import {
  MultipleSelect,
  MultipleSelectItem,
  Select,
  SelectItem
} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import type {
  MultipleSelectOptions,
  SelectField,
  SelectOptions
} from './SelectField.js'

export interface SelectFieldViewProps<
  Value extends KeyType | null,
  KeyType extends string
> {
  field: SelectField<Value, KeyType>
}

export function SelectFieldView<
  Value extends KeyType | null,
  KeyType extends string
>({field}: SelectFieldViewProps<Value, KeyType>) {
  const [value, setValue] = useField(field)
  const options = useFieldOptions(field) as SelectOptions<KeyType, Value>
  const error = useFieldError(field)
  return (
    <Select
      description={options.help}
      error={error}
      disabled={options.readOnly}
      required={options.required}
      aria-label={options.inline ? options.label : undefined}
      label={options.inline ? undefined : options.label}
      shared={options.shared}
      onValueChange={next => setValue(next as Value)}
      placeholder={
        options.placeholder ?? (options.inline ? options.label : undefined)
      }
      value={value}
    >
      {Object.entries<string>(options.options).map(([id, label]) => (
        <SelectItem key={id} value={id}>
          {label}
        </SelectItem>
      ))}
    </Select>
  )
}

export interface MultipleSelectFieldViewProps<KeyType extends string> {
  field: SelectField<Array<KeyType>, KeyType>
}

export function MultipleSelectFieldView<KeyType extends string>({
  field
}: MultipleSelectFieldViewProps<KeyType>) {
  const [value, setValue] = useField(field)
  const options = useFieldOptions(field) as MultipleSelectOptions<KeyType>
  const error = useFieldError(field)
  return (
    <MultipleSelect
      description={options.help}
      error={error}
      disabled={options.readOnly}
      required={options.required}
      aria-label={options.inline ? options.label : undefined}
      label={options.inline ? undefined : options.label}
      shared={options.shared}
      onValueChange={next => setValue(next as Array<KeyType>)}
      placeholder={
        options.placeholder ?? (options.inline ? options.label : undefined)
      }
      value={value}
    >
      {Object.entries<string>(options.options).map(([id, label]) => (
        <MultipleSelectItem key={id} value={id} textValue={label}>
          {label}
        </MultipleSelectItem>
      ))}
    </MultipleSelect>
  )
}
