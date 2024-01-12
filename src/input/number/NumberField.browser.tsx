import {Field} from 'alinea/core'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {fromModule} from 'alinea/ui'
import {IcRoundNumbers} from 'alinea/ui/icons/IcRoundNumbers'
import {useEffect, useRef} from 'react'
import {NumberField, number as createNumber} from './NumberField.js'
import css from './NumberInput.module.scss'

export * from './NumberField.js'

export const number = Field.provideView(NumberInput, createNumber)

const styles = fromModule(css)

interface NumberInputProps {
  field: NumberField
}

function tryParseNumber(input: string) {
  const value = parseFloat(input)
  return isNaN(value) ? null : value
}

function NumberInput({field}: NumberInputProps) {
  const {options, value, mutator} = useField(field)
  const {minValue, maxValue, readOnly, step} = options
  const ref = useRef<HTMLInputElement>(null)
  const defaultValue = String(value ?? '')
  useEffect(() => {
    const input = ref.current
    if (!input) return
    const currentInput = tryParseNumber(input.value)
    if (currentInput === value) return
    // facebook/react#25384
    input.value = defaultValue
  }, [defaultValue])
  return (
    <InputLabel asLabel {...options} icon={IcRoundNumbers}>
      <input
        type="number"
        ref={ref}
        className={styles.root.input()}
        defaultValue={defaultValue}
        onChange={({currentTarget}) => {
          const value = tryParseNumber(currentTarget.value)
          mutator(value)
        }}
        onBlur={({currentTarget}) => {
          const value = tryParseNumber(currentTarget.value)
          mutator(value)
          currentTarget.value = String(value ?? '')
        }}
        min={minValue}
        max={maxValue}
        disabled={readOnly}
        step={step || 1}
      />
    </InputLabel>
  )
}
