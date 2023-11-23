import {Field} from 'alinea/core'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {HStack, fromModule} from 'alinea/ui'
import {IcRoundCode} from 'alinea/ui/icons/IcRoundCode'
import {TextareaAutosize} from 'alinea/ui/util/TextareaAutosize'
import {useState} from 'react'
import {CodeField, code as createCode} from './CodeField.js'
import css from './CodeInput.module.scss'

export * from './CodeField.js'

export const code = Field.provideView(CodeInput, createCode)

const styles = fromModule(css)

interface CodeInputProps {
  state: InputState<InputState.Scalar<string>>
  field: CodeField
}

// Todo: use @tiptap/extension-code-block-lowlight which would require an
// extra value type "PlainText" which has no concept of blocks or formatting
// and is stored as a simple string, but using an XMLFragment on the Yjs
// side so we can have it be collaborative.
function CodeInput({state, field}: CodeInputProps) {
  const {label, options} = field[Field.Data]
  const [value, setValue] = useInput(state)
  const [focus, setFocus] = useState(false)

  const placeholder = options.inline ? String(label) : ''
  const empty = value === ''
  return (
    <InputLabel
      asLabel
      label={label}
      {...options}
      focused={focus}
      icon={IcRoundCode}
      empty={empty}
    >
      <HStack center gap={8}>
        <TextareaAutosize
          className={styles.root.input()}
          type="text"
          value={value || ''}
          onChange={e => setValue(e.currentTarget.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          spellCheck="false"
          disabled={options.readOnly}
        />
      </HStack>
    </InputLabel>
  )
}
