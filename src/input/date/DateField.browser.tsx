import {Field} from 'alinea/core'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {fromModule} from 'alinea/ui'
import {IcRoundDateRange} from 'alinea/ui/icons/IcRoundDateRange'
import {DateField, date as createDate} from './DateField.js'
import css from './DateInput.module.scss'

export * from './DateField.js'

export const date = Field.provideView(DateInput, createDate)

const styles = fromModule(css)

interface DateInputProps {
  field: DateField
}

function DateInput({field}: DateInputProps) {
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
