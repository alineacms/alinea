import styler from '@alinea/styler'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {IcRoundDateRange} from 'alinea/ui/icons/IcRoundDateRange'
import {TimeField} from './TimeField.js'
import css from './TimeField.module.scss'

const styles = styler(css)

export interface TimeInputProps {
  field: TimeField
}

export function TimeInput({field}: TimeInputProps) {
  const {options, value, mutator, error} = useField(field)
  const {minValue, maxValue, readOnly, step, autoFocus} = options
  return (
    <InputLabel asLabel {...options} error={error} icon={IcRoundDateRange}>
      <input
        className={styles.root.input()}
        type="time"
        value={value ?? ''}
        onChange={e => mutator(e.currentTarget.value)}
        autoFocus={autoFocus}
        readOnly={readOnly}
        min={minValue}
        max={maxValue}
        step={step || 60}
      />
    </InputLabel>
  )
}
