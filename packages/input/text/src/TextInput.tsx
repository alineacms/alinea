import {InputLabel, InputState, useInput} from '@alineacms/editor'
import {fromModule, HStack} from '@alineacms/ui'
import {useState} from 'react'
import {TextareaAutosize} from 'react-autosize-textarea/lib/TextareaAutosize.js'
import {MdTextFields} from 'react-icons/md'
import {TextField} from './TextField'
import css from './TextInput.module.scss'

const styles = fromModule(css)

export type TextInputProps = {
  state: InputState<InputState.Scalar<string>>
  field: TextField
}

export function TextInput({state, field}: TextInputProps) {
  const [value, setValue] = useInput(state)
  const [focus, setFocus] = useState(false)
  const {
    width,
    multiline,
    inline,
    optional,
    help,
    iconLeft: IconLeft,
    iconRight: IconRight
  } = field.options
  const Input = multiline ? TextareaAutosize : 'input'
  // Todo: unlocalise
  const placeholder = inline ? String(field.label) : ''
  const empty = value === ''
  return (
    <InputLabel
      asLabel
      label={field.label}
      help={help}
      optional={optional}
      inline={inline}
      width={width}
      focused={focus}
      icon={MdTextFields}
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
        />
        {IconRight && <IconRight />}
      </HStack>
    </InputLabel>
  )
}
