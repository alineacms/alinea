import {InputLabel, InputState, useInput} from 'alinea/editor'
import {HStack, fromModule} from 'alinea/ui'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {TextareaAutosize} from 'alinea/ui/util/TextareaAutosize'
import {useEffect, useState} from 'react'
import {JsonField} from './JsonField.js'
import css from './JsonInput.module.scss'

const styles = fromModule(css)

export type JsonInputProps = {
  state: InputState<InputState.Scalar<any>>
  field: JsonField
}

export function JsonInput({state, field}: JsonInputProps) {
  const [value, setValue] = useInput(state)
  const [text, setText] = useState(JSON.stringify(value, null, 2))
  const [valid, setValid] = useState(true)
  const [focus, setFocus] = useState(false)
  const {
    width,
    inline,
    optional,
    help,
    iconLeft: IconLeft,
    iconRight: IconRight,
    autoFocus
  } = field.options

  // Todo: unlocalise
  // Todo: redraw textarea on fontSize change
  const placeholder = inline ? String(field.label) : ''
  const empty = value === ''

  useEffect(() => {
    try {
      const newValue = JSON.parse(text)
      setValue(newValue)
      setValid(true)
    } catch (e) {
      setValid(false)
    }
  }, [text])

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
      empty={empty}
    >
      <HStack center gap={8}>
        {IconLeft && <IconLeft />}
        <TextareaAutosize
          className={styles.root.input({valid})}
          type="text"
          value={text || ''}
          onChange={e => setText(e.currentTarget.value)}
          onFocus={() => setFocus(true)}
          onKeyDown={e => {
            if (e.key == 'Tab') {
              const target = e.target as HTMLInputElement
              var start = target.selectionStart!
              var end = target.selectionEnd!
              const value = target.value

              if (end !== value.length) {
                e.preventDefault()
                target.value =
                  value.substring(0, start) + '  ' + value.substring(end)
                target.selectionStart = target.selectionEnd = start + 2
              }
            }
          }}
          onBlur={() => {
            setFocus(false)
            if (valid) {
              setText(JSON.stringify(value, null, 2))
            }
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
        {IconRight && <IconRight />}
      </HStack>
    </InputLabel>
  )
}
