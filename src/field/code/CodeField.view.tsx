import styler from '@alinea/styler'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {HStack} from 'alinea/ui'
import {IcRoundCode} from 'alinea/ui/icons/IcRoundCode'
import {TextareaAutosize} from 'alinea/ui/util/TextareaAutosize'
import {useState} from 'react'
import {CodeField} from './CodeField.js'
import css from './CodeField.module.scss'

const styles = styler(css)

export interface CodeInputProps {
  field: CodeField
}

// Todo: use @tiptap/extension-code-block-lowlight which would require an
// extra value type "PlainText" which has no concept of blocks or formatting
// and is stored as a simple string, but using an XMLFragment on the Yjs
// side so we can have it be collaborative.
export function CodeInput({field}: CodeInputProps) {
  const {value, mutator, label, options, error} = useField(field)
  const [focus, setFocus] = useState(false)

  const placeholder = options.inline ? String(label) : ''
  const empty = value === ''
  return (
    <InputLabel
      asLabel
      {...options}
      error={error}
      focused={focus}
      icon={IcRoundCode}
      empty={empty}
    >
      <HStack center gap={8}>
        <TextareaAutosize
          className={styles.root.input()}
          type="text"
          value={value || ''}
          onChange={e => mutator(e.currentTarget.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          spellCheck="false"
          readOnly={options.readOnly}
        />
      </HStack>
    </InputLabel>
  )
}
