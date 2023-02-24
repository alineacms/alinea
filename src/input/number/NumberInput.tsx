import {InputLabel, InputState, useInput} from 'alinea/editor'

import {fromModule} from 'alinea/ui'
import {IcRoundNumbers} from 'alinea/ui/icons/IcRoundNumbers'
import {NumberField} from './NumberField.js'
import css from './NumberInput.module.scss'

const styles = fromModule(css)

export type NumberInputProps = {
  state: InputState<InputState.Scalar<number>>
  field: NumberField
}

export function NumberInput({state, field}: NumberInputProps) {
  const {
    inline,
    help,
    optional,
    initialValue,
    width,
    minValue,
    maxValue,
    step
  } = field.options
  const [value = initialValue, setValue] = useInput(state)

  return (
    <InputLabel
      asLabel
      label={field.label}
      inline={inline}
      help={help}
      optional={optional}
      width={width}
      icon={IcRoundNumbers}
    >
      <input
        type="number"
        className={styles.root.input()}
        value={String(value ?? '')}
        onChange={e =>
          setValue(
            e.currentTarget.value === ''
              ? undefined!
              : Number(e.currentTarget.value)
          )
        }
        min={minValue}
        max={maxValue}
        step={step || 1}
      />
    </InputLabel>
  )
}
