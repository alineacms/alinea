import {HStack, Icon, TextLabel, fromModule} from '@alinea/ui'
import {InputLabel, InputState, useInput} from '@alinea/editor'

import {CheckField} from './CheckField'
import {IcRoundCheck} from '@alinea/ui/icons/IcRoundCheck'
import {IcRoundTextFields} from '@alinea/ui/icons/IcRoundTextFields'
import css from './CheckInput.module.scss'
import {useState} from 'react'

const styles = fromModule(css)

export type CheckInputProps = {
  state: InputState<InputState.Scalar<boolean>>
  field: CheckField
}

export function CheckInput({state, field}: CheckInputProps) {
  const {
    label,
    width,
    inline,
    optional,
    help,
    autoFocus,
    initialValue,
    readonly
  } = field.options
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
          disabled={readonly}
        />
        <span className={styles.root.checkmark({disabled: readonly})}>
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
          className={styles.root.label({disabled: readonly})}
        />
      </HStack>
    </InputLabel>
  )
}
