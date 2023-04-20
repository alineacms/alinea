import {Field} from 'alinea/core'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {HStack, fromModule} from 'alinea/ui'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {TextareaAutosize} from 'alinea/ui/util/TextareaAutosize'
import {useState} from 'react'
import {TextField, text as createText} from './TextField.js'
import css from './TextInput.module.scss'

export * from './TextField.js'

export const text = Field.provideView(TextInput, createText)

const styles = fromModule(css)

interface TextInputProps {
  state: InputState<InputState.Scalar<string>>
  field: TextField
}

function TextInput({state, field}: TextInputProps) {
  const [value, setValue] = useInput(state)
  const [focus, setFocus] = useState(false)
  const {label, options} = field[Field.Data]
  const {
    width,
    multiline,
    inline,
    optional,
    help,
    iconLeft: IconLeft,
    iconRight: IconRight,
    autoFocus
  } = options

  const Input = multiline ? TextareaAutosize : 'input'
  // Todo: unlocalise
  // Todo: redraw textarea on fontSize change
  const placeholder = inline ? String(label) : ''
  const empty = value === ''
  return (
    <InputLabel
      asLabel
      label={label}
      help={help}
      optional={optional}
      inline={inline}
      width={width}
      focused={focus}
      icon={IcRoundTextFields}
      empty={empty}
    >
      <HStack center gap={8}>
        {IconLeft && <IconLeft />}
        <Input
          className={styles.root.input()}
          type="text"
          value={value || ''}
          onChange={e => setValue(e.currentTarget.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={options.readonly}
        />
        {IconRight && <IconRight />}
      </HStack>
    </InputLabel>
  )
}
