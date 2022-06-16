import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule, HStack, Icon, TextLabel} from '@alinea/ui'
import {IcRoundCheck} from '@alinea/ui/icons/IcRoundCheck'
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
  const {
    label,
    width,
    inline,
    optional,
    help,
    autoFocus,
    initialValue,
    hidden
  } = field.options
  const [value = initialValue, setValue] = useInput(state)
  const [focus, setFocus] = useState(false)
  // Todo: unlocalise
  if (hidden) return null

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
      <HStack gap={8} style={{display: 'inline-flex'}}>
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
          {value && <Icon size={20} icon={IcRoundCheck} />}
        </span>
        <TextLabel label={label} className={styles.root.label()} />
      </HStack>
    </InputLabel>
  )
}
