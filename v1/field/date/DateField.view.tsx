import styler from '@alinea/styler'
import {useField} from '#/dashboard/editor/UseField.js'
import {InputLabel} from '#/dashboard/view/InputLabel.js'
import {IcRoundDateRange} from '#/ui/icons/IcRoundDateRange.js'
import type {DateField} from './DateField.js'
import css from './DateField.module.scss'

const styles = styler(css)

export interface DateInputProps {
  field: DateField
}

export function DateInput({field}: DateInputProps) {
  const {options, value, mutator, error} = useField(field)
  return (
    <InputLabel asLabel {...options} error={error} icon={IcRoundDateRange}>
      <input
        className={styles.root.input()}
        type="date"
        value={value ?? ''}
        onChange={e => mutator(e.currentTarget.value)}
        readOnly={options.readOnly}
      />
    </InputLabel>
  )
}
