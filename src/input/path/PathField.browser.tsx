import {Field, isSeparator, slugify} from 'alinea/core'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {fromModule} from 'alinea/ui'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'
import {useState} from 'react'
import {PathField, path as createPath} from './PathField.js'
import css from './PathInput.module.scss'
export * from './PathField.js'

export const path = Field.provideView(PathInput, createPath)

const styles = fromModule(css)

type PathInputProps = {
  state: InputState<InputState.Scalar<string>>
  field: PathField
}

function PathInput({state, field}: PathInputProps) {
  const {label, options} = field[Field.Data]
  const {width, from = 'title', help, optional} = options
  const [focus, setFocus] = useState(false)
  const parentState = state.parent()
  if (!parentState) throw new Error('Path field needs parent state')
  const [source = ''] = useInput<InputState.Scalar<string>>(
    parentState.child(from)
  )
  const [value = slugify(source), setValue] =
    useInput<InputState.Scalar<string>>(state)
  const [endsWithSeparator, setEndsWithSeparator] = useState(false)
  const inputValue = (value || '') + (endsWithSeparator ? '-' : '')
  const empty = value === ''
  return (
    <InputLabel
      asLabel
      label={label}
      help={help}
      optional={optional}
      width={width}
      focused={focus}
      icon={IcRoundLink}
      empty={empty}
    >
      <input
        className={styles.root.input()}
        type="text"
        value={inputValue}
        onChange={e => {
          const value = e.currentTarget.value
          setEndsWithSeparator(isSeparator(value.charAt(value.length - 1)))
          setValue(slugify(value))
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={' '}
        disabled={options.readonly}
      />
    </InputLabel>
  )
}
