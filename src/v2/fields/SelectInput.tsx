import {Select, SelectItem} from '@alinea/components'
import styler from '@alinea/styler'
import type {EntryFieldViewProps} from './FieldView.js'
import css from './FieldViews.module.css'

const styles = styler(css)

interface SelectOption {
  id: string
  label: string
}

function selectOptions(source: unknown): Array<SelectOption> {
  if (!source || typeof source !== 'object') return []
  const entries = Object.entries(source as Record<string, string>)
  return entries.map(([id, label]) => ({id, label: String(label)}))
}

function selectedKey(value: unknown, options: Array<SelectOption>): string | null {
  if (typeof value !== 'string') return null
  return options.some(option => option.id === value) ? value : null
}

export function SelectInput({
  id,
  label,
  value,
  options,
  onChange,
  readOnly,
  required
}: EntryFieldViewProps) {
  const items = selectOptions(options.options)

  return (
    <Select
      id={id}
      aria-label={label}
      className={styles.control()}
      items={items}
      selectedKey={selectedKey(value, items)}
      isDisabled={readOnly}
      isRequired={required}
      placeholder={typeof options.placeholder === 'string' ? options.placeholder : undefined}
      onSelectionChange={function onSelectionChange(key) {
        const selected = key ? String(key) : null
        onChange(selected)
      }}
    >
      {function renderOption(option) {
        return <SelectItem id={option.id}>{option.label}</SelectItem>
      }}
    </Select>
  )
}
