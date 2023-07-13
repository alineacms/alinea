import {Field} from 'alinea/core'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {HStack, Icon, TextLabel, fromModule} from 'alinea/ui'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {useState} from 'react'
import {CheckField, check as createCheck} from './CheckField.js'
import css from './CheckInput.module.scss'

export * from './CheckField.js'

export const check = Field.provideView(CheckInput, createCheck)

const styles = fromModule(css)

type CheckInputProps = {
  state: InputState<InputState.Scalar<boolean>>
  field: CheckField
}

function CheckInput({state, field}: CheckInputProps) {
  const {label, options} = field[Field.Data]
  const {readonly} = options
  const [value, setValue] = useInput(state)
  const [focus, setFocus] = useState(false)
  return (
    <InputLabel
      asLabel
      label={label}
      {...options}
      focused={focus}
      icon={IcRoundTextFields}
    >
      <HStack gap={8} style={{position: 'relative', display: 'inline-flex'}}>
        <input
          className={styles.root.input()}
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => setValue(e.currentTarget.checked)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          autoFocus={options.autoFocus}
          disabled={readonly}
        />
        <span className={styles.root.checkmark({disabled: options.readonly})}>
          {value && (
            <Icon
              size={20}
              icon={IcRoundCheck}
              className={styles.root.checkmark.icon()}
            />
          )}
        </span>
        <TextLabel label={label} className={styles.root.label()} />
      </HStack>
    </InputLabel>
  )
}
