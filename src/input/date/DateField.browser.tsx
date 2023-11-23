import {Field} from 'alinea/core'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {fromModule} from 'alinea/ui'
import {IcRoundDateRange} from 'alinea/ui/icons/IcRoundDateRange'
import {DateField, date as createDate} from './DateField.js'
import css from './DateInput.module.scss'

export * from './DateField.js'

export const date = Field.provideView(DateInput, createDate)

const styles = fromModule(css)

interface DateInputProps {
  state: InputState<InputState.Scalar<string>>
  field: DateField
}

function DateInput({state, field}: DateInputProps) {
  const {label, options} = field[Field.Data]
  const [value = options.initialValue, setValue] = useInput(state)
  return (
    <InputLabel asLabel label={label} {...options} icon={IcRoundDateRange}>
      <input
        className={styles.root.input()}
        type="date"
        value={value || ''}
        onChange={e => setValue(e.currentTarget.value)}
        autoFocus={options.autoFocus}
        disabled={options.readOnly}
      />
    </InputLabel>
  )
}
