import {Field} from 'alinea/core'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {fromModule} from 'alinea/ui'
import {IcRoundNumbers} from 'alinea/ui/icons/IcRoundNumbers'
import {number as createNumber, NumberField} from './NumberField.js'
import css from './NumberInput.module.scss'

export * from './NumberField.js'

export const number = Field.withView(createNumber, NumberInput)

const styles = fromModule(css)

type NumberInputProps = {
  state: InputState<InputState.Scalar<number>>
  field: NumberField
}

function NumberInput({state, field}: NumberInputProps) {
  const {
    inline,
    help,
    optional,
    initialValue,
    width,
    minValue,
    maxValue,
    readonly,
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
        disabled={readonly}
        step={step || 1}
      />
    </InputLabel>
  )
}
