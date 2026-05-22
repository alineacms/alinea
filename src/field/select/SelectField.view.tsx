import {Select, SelectItem} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import {SelectField, SelectOptions} from '#/field/select.js'
import {Key} from '@react-types/shared'
import {useMemo} from 'react'

interface SelectItemData {
  id: string
  label: string
}

export interface SelectFieldViewProps<KeyType extends string | null> {
  field: SelectField<KeyType>
}

export function SelectFieldView<KeyType extends string | null>({
  field
}: SelectFieldViewProps<KeyType>) {
  const [value, setValue] = useField(field)
  const options = useFieldOptions(field) as SelectOptions<NonNullable<KeyType>>
  const error = useFieldError(field)
  const items = useMemo(() => {
    return Object.entries<string>(options.options).map(
      ([id, label]): SelectItemData => ({id, label})
    )
  }, [options.options])

  function handleSelectionChange(key: Key | null) {
    setValue((key === null ? null : String(key)) as KeyType)
  }

  return (
    <Select
      description={options.help}
      errorMessage={error}
      isDisabled={options.readOnly}
      isRequired={options.required}
      items={items}
      label={options.label}
      onSelectionChange={handleSelectionChange}
      placeholder={options.placeholder}
      selectedKey={value ?? null}
    >
      {item => <SelectItem id={item.id}>{item.label}</SelectItem>}
    </Select>
  )
}
