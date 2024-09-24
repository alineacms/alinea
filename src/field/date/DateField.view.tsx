import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {fromModule} from 'alinea/ui'
import {IcRoundDateRange} from 'alinea/ui/icons/IcRoundDateRange'
import {DateField} from './DateField.js'
import css from './DateField.module.scss'

const styles = fromModule(css)

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
        autoFocus={options.autoFocus}
        readOnly={options.readOnly}
      />
    </InputLabel>
  )
}
