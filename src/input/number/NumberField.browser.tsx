import {Field} from 'alinea/core'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {fromModule} from 'alinea/ui'
import {IcRoundNumbers} from 'alinea/ui/icons/IcRoundNumbers'
import {NumberField, number as createNumber} from './NumberField.js'
import css from './NumberInput.module.scss'

export * from './NumberField.js'

export const number = Field.provideView(NumberInput, createNumber)

const styles = fromModule(css)

interface NumberInputProps {
  state: InputState<InputState.Scalar<number | null>>
  field: NumberField
}

function NumberInput({state, field}: NumberInputProps) {
  const {label, options} = field[Field.Data]
  const {inline, help, optional, width, minValue, maxValue, readonly, step} =
    options
  const [value, setValue] = useInput(state)

  return (
    <InputLabel
      asLabel
      label={label}
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
            e.currentTarget.value === '' ? null : Number(e.currentTarget.value)
          )
        }
        min={minValue}
        max={maxValue}
        disabled={readonly}
        step={step || 1}
      />
    </InputLabel>
  )
}
