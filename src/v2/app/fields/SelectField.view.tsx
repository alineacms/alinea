import {Select, SelectItem} from '@alinea/components'
import {Key} from '@react-types/shared'
import {SelectField, SelectOptions} from 'alinea/field/select'
import {useMemo} from 'react'
import {useFieldError, useFieldOptions, useFieldValue} from '../../store.js'

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
  const [value, setValue] = useFieldValue(field)
  const options = useFieldOptions(field) as SelectOptions<NonNullable<KeyType>>
  const error = useFieldError(field)
  const items = useMemo<Array<SelectItemData>>(() => {
    return Object.entries(options.options).map(([id, label]) => ({id, label}))
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
