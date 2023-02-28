import {Field} from 'alinea/core'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {fromModule, HStack, Icon, TextLabel} from 'alinea/ui'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {useState} from 'react'
import {check as createCheck, CheckField} from './CheckField.js'
import css from './CheckInput.module.scss'

export * from './CheckField.js'

export const check = Field.withView(createCheck, CheckInput)

const styles = fromModule(css)

type CheckInputProps = {
  state: InputState<InputState.Scalar<boolean>>
  field: CheckField
}

function CheckInput({state, field}: CheckInputProps) {
  const {label, width, inline, optional, help, autoFocus, initialValue} =
    field.options
  const [value = initialValue, setValue] = useInput(state)
  const [focus, setFocus] = useState(false)
  // Todo: unlocalise

  return (
    <InputLabel
      asLabel
      label={field.label}
      help={help}
      optional={optional}
      inline={inline}
      width={width}
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
          autoFocus={autoFocus}
        />
        <span className={styles.root.checkmark()}>
          {value && (
            <Icon
              size={20}
              icon={IcRoundCheck}
              className={styles.root.checkmark.icon()}
            />
          )}
        </span>
        <TextLabel
          label={label || field.label}
          className={styles.root.label()}
        />
      </HStack>
    </InputLabel>
  )
}
