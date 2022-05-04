import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule, HStack, TextLabel} from '@alinea/ui'
import {IcRoundTextFields} from '@alinea/ui/icons/IcRoundTextFields'
import {useState} from 'react'
import {CheckField} from './CheckField'
import css from './CheckInput.module.scss'

const styles = fromModule(css)

export type CheckInputProps = {
  state: InputState<InputState.Scalar<boolean>>
  field: CheckField
}

export function CheckInput({state, field}: CheckInputProps) {
  const {width, inline, optional, help, autoFocus, initialValue} = field.options
  const [value = initialValue, setValue] = useInput(state)
  const [focus, setFocus] = useState(false)
  // Todo: unlocalise
  return (
    <InputLabel
      asLabel
      label={field.label}
      optional={optional}
      inline={inline}
      width={width}
      focused={focus}
      icon={IcRoundTextFields}
    >
      <HStack center gap={8}>
        <input
          className={styles.root.input()}
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => setValue(e.currentTarget.checked)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          autoFocus={autoFocus}
        />
        <TextLabel label={help || field.label} />
      </HStack>
    </InputLabel>
  )
}
