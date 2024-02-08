import {Field} from 'alinea/core'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {HStack, fromModule} from 'alinea/ui'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {TextareaAutosize} from 'alinea/ui/util/TextareaAutosize'
import {useState} from 'react'
import {TextField, text as createText} from './TextField.js'
import css from './TextField.module.scss'

export * from './TextField.js'

export const text = Field.provideView(TextInput, createText)

const styles = fromModule(css)

interface TextInputProps {
  field: TextField
}

function TextInput({field}: TextInputProps) {
  const {value, mutator, label, options, error} = useField(field)
  const [focus, setFocus] = useState(false)
  const {
    multiline,
    inline,
    iconLeft: IconLeft,
    iconRight: IconRight,
    autoFocus,
    readOnly
  } = options
  const Input = multiline ? TextareaAutosize : 'input'
  const placeholder = inline ? label : ''
  const empty = value === ''
  return (
    <InputLabel
      asLabel
      {...options}
      error={error}
      empty={empty}
      focused={focus}
      icon={IcRoundTextFields}
    >
      <HStack center gap={8}>
        {IconLeft && <IconLeft />}
        <Input
          className={styles.root.input({readOnly})}
          type="text"
          value={value || ''}
          onChange={e => mutator(e.currentTarget.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          readOnly={options.readOnly}
        />
        {IconRight && <IconRight />}
      </HStack>
    </InputLabel>
  )
}
