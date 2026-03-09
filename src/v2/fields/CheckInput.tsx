import {Checkbox} from '@alinea/components'
import styler from '@alinea/styler'
import type {EntryFieldViewProps} from './FieldView.js'
import css from './FieldViews.module.css'

const styles = styler(css)

function booleanValue(value: unknown): boolean {
  return value === true
}

function checkboxLabel(label: string, description: unknown): string {
  if (typeof description === 'string' && description.length > 0) {
    return description
  }
  return label
}

export function CheckInput({
  id,
  label,
  value,
  options,
  onChange,
  readOnly,
  required
}: EntryFieldViewProps) {
  return (
    <Checkbox
      id={id}
      aria-label={label}
      className={styles.check()}
      isSelected={booleanValue(value)}
      onChange={function onChangeChecked(nextValue) {
        onChange(nextValue)
      }}
      isDisabled={readOnly}
      isRequired={required}
      label={checkboxLabel(label, options.description)}
    />
  )
}
