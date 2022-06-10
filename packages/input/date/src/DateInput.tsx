import { InputLabel, InputState, useInput } from '@alinea/editor'
import { fromModule } from '@alinea/ui'
import { IcRoundDateRange } from '@alinea/ui/icons/IcRoundDateRange'
import { DateField } from './DateField'
import css from './DateInput.module.scss'

const styles = fromModule(css)

export type DateInputProps = {
  state: InputState<InputState.Scalar<string>>
  field: DateField
}

export function DateInput({state, field}: DateInputProps) {
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
