import {TextField} from '@alinea/components'
import styler from '@alinea/styler'
import type {EntryFieldViewProps} from './FieldView.js'
import css from './FieldViews.module.css'

const styles = styler(css)

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function placeholder(label: string, value: unknown, hint: unknown): string {
  if (typeof hint === 'string' && hint.length > 0) return hint
  if (stringValue(value).length > 0) return ''
  return `Enter ${label.toLowerCase()}`
}

export function TextInput({
  id,
  label,
  options,
  value,
  onChange,
  readOnly,
  required
}: EntryFieldViewProps) {
  const multiline = Boolean(options.multiline)
  const inputType = options.type || 'text'

  return (
    <TextField
      id={id}
      aria-label={label}
      className={styles.control()}
      value={stringValue(value)}
      onChange={function onChangeText(nextValue) {
        onChange(nextValue)
      }}
      multiline={multiline}
      rows={multiline ? 4 : undefined}
      type={inputType}
      isReadOnly={readOnly}
      isRequired={required}
      placeholder={placeholder(label, value, options.placeholder)}
    />
  )
}
