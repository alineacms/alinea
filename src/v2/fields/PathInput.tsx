import {TextField} from '@alinea/components'
import styler from '@alinea/styler'
import {slugify} from 'alinea/core/util/Slugs'
import type {EntryFieldViewProps} from './FieldView.js'
import css from './FieldViews.module.css'

const styles = styler(css)

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function PathInput({
  id,
  label,
  value,
  onChange,
  readOnly,
  required
}: EntryFieldViewProps) {
  return (
    <TextField
      id={id}
      aria-label={label}
      className={styles.control()}
      value={stringValue(value)}
      onChange={function onChangePath(nextValue) {
        onChange(slugify(nextValue))
      }}
      placeholder="path-segment"
      isReadOnly={readOnly}
      isRequired={required}
    />
  )
}
