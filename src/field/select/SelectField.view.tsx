import {
  MultipleSelect,
  MultipleSelectItem,
  Select,
  SelectItem,
  Tag
} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import type {Key} from '@react-types/shared'
import {type ReactNode, useMemo} from 'react'
import {useListData} from 'react-stately'
import type {
  MultipleSelectOptions,
  SelectField,
  SelectOptions
} from './SelectField.js'

interface SelectItemData<KeyType extends string> {
  id: KeyType
  name: string
  label: string
}

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
  const items = useMemo(() => {
    return Object.entries<string>(options.options).map(
      ([id, label]): SelectItemData<KeyType> => ({
        id: id as KeyType,
        name: label,
        label
      })
    )
  }, [options.options])

  function handleSelectionChange(key: Key | null) {
    setValue((key === null ? null : String(key)) as Value)
  }

  return (
    <Select
      description={options.help}
      errorMessage={error}
      isDisabled={options.readOnly}
      isRequired={options.required}
      items={items}
      label={options.label}
      shared={options.shared}
      onSelectionChange={handleSelectionChange}
      placeholder={options.placeholder}
      selectedKey={value}
    >
      {item => <SelectItem id={item.id}>{item.label}</SelectItem>}
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
  const items = useMemo(() => {
    return Object.entries<string>(options.options).map(
      ([id, label]): SelectItemData<KeyType> => ({
        id: id as KeyType,
        name: label,
        label
      })
    )
  }, [options.options])

  function handleItemInserted(key: Key) {
    const itemKey = String(key) as KeyType
    setValue(current => {
      if (current.includes(itemKey)) return current
      return [...current, itemKey]
    })
  }

  function handleItemCleared(key: Key) {
    const itemKey = String(key) as KeyType
    setValue(current => {
      return current.filter(key => key !== itemKey)
    })
  }

  return (
    <SelectFieldMultipleInput
      key={value.join('\0')}
      description={options.help}
      errorMessage={error}
      isDisabled={options.readOnly}
      isRequired={options.required}
      items={items}
      label={options.label}
      shared={options.shared}
      onItemCleared={handleItemCleared}
      onItemInserted={handleItemInserted}
      placeholder={options.placeholder}
      selectedKeys={value}
    />
  )
}

interface SelectFieldMultipleViewProps<KeyType extends string> {
  description?: ReactNode
  errorMessage?: string
  isDisabled?: boolean
  isRequired?: boolean
  items: Array<SelectItemData<KeyType>>
  label: ReactNode
  shared?: boolean
  onItemCleared: (key: Key) => void
  onItemInserted: (key: Key) => void
  placeholder?: string
  selectedKeys: Array<KeyType>
}

function SelectFieldMultipleInput<KeyType extends string>({
  items,
  selectedKeys,
  ...props
}: SelectFieldMultipleViewProps<KeyType>) {
  const selectedItems = useListData<SelectItemData<KeyType>>({
    initialItems: selectedKeys
      .map(key => items.find(item => item.id === key))
      .filter((item): item is SelectItemData<KeyType> => Boolean(item))
  })

  return (
    <MultipleSelect
      {...props}
      items={items}
      selectedItems={selectedItems}
      tag={item => <Tag data-shape="circle">{item.label}</Tag>}
    >
      {item => (
        <MultipleSelectItem id={item.id} textValue={item.label}>
          {item.label}
        </MultipleSelectItem>
      )}
    </MultipleSelect>
  )
}
