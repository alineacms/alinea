import {InputLabel, InputState, useInput} from '@alinea/editor'

import {IcRoundNumbers} from '@alinea/ui/icons/IcRoundNumbers'
import {NumberField} from './NumberField'
import css from './NumberInput.module.scss'
import {fromModule} from '@alinea/ui'
import {useState} from 'react'

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
  const [value, setValue] = useInput(state)
  const [defined, setDefined] = useState<boolean>(typeof value === undefined)

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
        value={
          String(value ?? '') || (!defined ? String(initialValue ?? '') : '')
        }
        onChange={e => {
          setValue(
            e.currentTarget.value === ''
              ? undefined!
              : Number(e.currentTarget.value)
          )
          if (!defined) setDefined(true)
        }}
        onBlur={e => {
          if (
            !optional &&
            value === undefined &&
            typeof initialValue !== 'undefined'
          )
            setValue(initialValue)
        }}
        min={minValue}
        max={maxValue}
        step={step || 1}
      />
    </InputLabel>
  )
}
