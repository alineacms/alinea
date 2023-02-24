import {Field} from 'alinea/core'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {fromModule} from 'alinea/ui'
import {IcRoundDateRange} from 'alinea/ui/icons/IcRoundDateRange'
import {date as createDate, DateField} from './DateField.js'
import css from './DateInput.module.scss'

export * from './DateField.js'

export const date = Field.withView(createDate, DateInput)

const styles = fromModule(css)

type DateInputProps = {
  state: InputState<InputState.Scalar<string>>
  field: DateField
}

function DateInput({state, field}: DateInputProps) {
  const {width, inline, optional, help, autoFocus, initialValue} = field.options
  const [value = initialValue, setValue] = useInput(state)

  return (
    <InputLabel
      asLabel
      label={field.label}
      help={help}
      optional={optional}
      inline={inline}
      width={width}
      icon={IcRoundDateRange}
    >
      <input
        className={styles.root.input()}
        type="date"
        value={value || ''}
        onChange={e => setValue(e.currentTarget.value)}
        autoFocus={autoFocus}
      />
    </InputLabel>
  )
}
