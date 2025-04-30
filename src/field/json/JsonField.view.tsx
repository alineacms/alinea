import styler from '@alinea/styler'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {HStack} from 'alinea/ui'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {TextareaAutosize} from 'alinea/ui/util/TextareaAutosize'
import {useEffect, useState} from 'react'
import type {JsonField} from './JsonField.js'
import css from './JsonField.module.scss'

const styles = styler(css)

export interface JsonInputProps<T> {
  field: JsonField<T>
}

export function JsonInput<T>({field}: JsonInputProps<T>) {
  const {options, value, mutator, label, error} = useField(field)
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
      mutator(newValue)
      setValid(true)
    } catch (e) {
      setValid(!text)
    }
  }, [text])

  return (
    <InputLabel
      asLabel
      {...options}
      error={error}
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
            if (e.key === 'Tab') {
              const target = e.target as HTMLInputElement
              const start = target.selectionStart!
              const end = target.selectionEnd!
              const value = target.value

              if (end !== value.length) {
                e.preventDefault()
                target.value =
                  `${value.substring(0, start)}  ${value.substring(end)}`
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
          readOnly={options.readOnly}
        />
      </HStack>
    </InputLabel>
  )
}
