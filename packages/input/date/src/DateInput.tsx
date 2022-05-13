import {InputLabel, InputState, useInput} from '@alinea/editor'

import {DateField} from './DateField'
import {IcRoundDateRange} from '@alinea/ui/icons/IcRoundDateRange'
import css from './DateInput.module.scss'
import {fromModule} from '@alinea/ui'
import {useState} from 'react'

const styles = fromModule(css)

export type DateInputProps = {
  state: InputState<InputState.Scalar<string>>
  field: DateField
}

export function DateInput({state, field}: DateInputProps) {
  const {width, inline, optional, help, autoFocus, initialValue} = field.options
  const [value = initialValue, setValue] = useInput(state)
  const [focus, setFocus] = useState(false)
  console.log(value, value === '')
  return (
    <InputLabel
      asLabel
      label={field.label}
      optional={optional}
      inline={inline}
      width={width}
      focused={focus}
      icon={IcRoundDateRange}
    >
      <input
        className={styles.root.input()}
        type="date"
        value={value}
        onChange={e => setValue(e.currentTarget.value)}
        autoFocus={autoFocus}
      />
    </InputLabel>
  )
}
