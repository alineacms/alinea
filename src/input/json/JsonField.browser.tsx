import {Field} from 'alinea/core'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {HStack, fromModule} from 'alinea/ui'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {TextareaAutosize} from 'alinea/ui/util/TextareaAutosize'
import {useEffect, useState} from 'react'
import {JsonField, json as createJson} from './JsonField.js'
import css from './JsonInput.module.scss'

export * from './JsonField.js'

export const json = Field.provideView(JsonInput, createJson)

const styles = fromModule(css)

interface JsonInputProps<T> {
  state: InputState<InputState.Scalar<T>>
  field: JsonField<T>
}

function JsonInput<T>({state, field}: JsonInputProps<T>) {
  const {label, options} = field[Field.Data]
  const [value, setValue] = useInput(state)
  const [text, setText] = useState(JSON.stringify(value, null, 2))
  const [valid, setValid] = useState(true)
  const [focus, setFocus] = useState(false)
  const {inline, autoFocus} = options

  // Todo: unlocalise
  // Todo: redraw textarea on fontSize change
  const placeholder = inline ? String(label) : ''
  const empty = value === ''

  // Todo: @dmerckx - no useEffect needed here, just handle both text and value
  // setters in the event handlers
  useEffect(() => {
    try {
      const newValue = JSON.parse(text)
      setValue(newValue)
      setValid(true)
    } catch (e) {
      setValid(text ? false : true)
    }
  }, [text])

  return (
    <InputLabel
      asLabel
      label={label}
      {...options}
      focused={focus}
      icon={IcRoundTextFields}
      empty={empty}
    >
      <HStack center gap={8}>
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
          disabled={options.readonly}
        />
      </HStack>
    </InputLabel>
  )
}
