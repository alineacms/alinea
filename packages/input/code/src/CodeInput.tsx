import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule, HStack} from '@alinea/ui'
import {IcRoundCode} from '@alinea/ui/icons/IcRoundCode'
import {useState} from 'react'
import {TextareaAutosize} from 'react-autosize-textarea/lib/TextareaAutosize.js'
import {CodeField} from './CodeField'
import css from './CodeInput.module.scss'

const styles = fromModule(css)

export type CodeInputProps = {
  state: InputState<InputState.Scalar<string>>
  field: CodeField
}

// Todo: use @tiptap/extension-code-block-lowlight which would require an
// extra value type "PlainText" which has no concept of blocks or formatting
// and is stored as a simple string, but using an XMLFragment on the Yjs
// side so we can have it be collaborative.
export function CodeInput({state, field}: CodeInputProps) {
  const [value, setValue] = useInput(state)
  const [focus, setFocus] = useState(false)
  const {width, inline, optional, help, language} = field.options
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
        />
      </HStack>
    </InputLabel>
  )
}
